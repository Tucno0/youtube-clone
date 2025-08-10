import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  lt,
  or,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { commentReactions, comments, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";

export const commentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        value: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { videoId, value } = input;
      const { id: userId } = ctx.user;

      const [createdComment] = await db
        .insert(comments)
        .values({
          userId,
          videoId,
          value,
        })
        .returning();

      return createdComment;
    }),

  getMany: baseProcedure
    .input(
      z.object({
        videoId: z.string().uuid(),
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { clerkUserId } = ctx;
      const { videoId, cursor, limit } = input;

      let userId;

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      if (user) {
        userId = user.id;
      }

      const viewerReactions = await db.$with("viewer_reactions").as(
        db
          .select({
            commentId: commentReactions.commentId,
            type: commentReactions.type,
          })
          .from(commentReactions)
          .where(inArray(commentReactions.userId, userId ? [userId] : []))
      );

      const [totalData, data] = await Promise.all([
        await db
          .select({ count: count() })
          .from(comments)
          .where(eq(comments.videoId, videoId)),

        await db
          .with(viewerReactions)
          .select({
            ...getTableColumns(comments),
            user: getTableColumns(users),
            viewerReaction: viewerReactions.type,
            likeCount: db.$count(
              commentReactions,
              and(
                eq(commentReactions.type, "like"),
                eq(commentReactions.commentId, comments.id)
              )
            ),
            dislikeCount: db.$count(
              commentReactions,
              and(
                eq(commentReactions.type, "dislike"),
                eq(commentReactions.commentId, comments.id)
              )
            ),
          })
          .from(comments)
          .where(
            and(
              eq(comments.videoId, videoId),
              cursor
                ? or(
                    // Si hay cursor, aplicar lógica de paginación
                    lt(comments.updatedAt, cursor.updatedAt), // Comentarios más antiguos que el cursor
                    and(
                      eq(comments.updatedAt, cursor.updatedAt), // O Comentarios con la misma fecha
                      lt(comments.id, cursor.id) // pero ID menor
                    )
                  )
                : undefined
            )
          )
          .innerJoin(users, eq(comments.userId, users.id))
          .leftJoin(viewerReactions, eq(comments.id, viewerReactions.commentId)) // Unir con las reacciones del espectador
          .orderBy(desc(comments.updatedAt), desc(comments.id)) // Ordenar por fecha de actualización y ID descendente
          .limit(limit + 1), // +1 para determinar si hay más páginas
      ]);

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      return {
        totalCount: totalData[0].count ?? 0,
        items,
        nextCursor,
      };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const { id: userId } = ctx.user;

      const [deletedComment] = await db
        .delete(comments)
        .where(and(eq(comments.id, id), eq(comments.userId, userId)))
        .returning();

      if (!deletedComment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Comment not found or you don't have permission to delete it",
        });
      }

      return deletedComment;
    }),
});
