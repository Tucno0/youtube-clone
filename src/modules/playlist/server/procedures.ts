import { z } from "zod";
import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";

// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { users, videoReactions, videos, videoViews } from "@/db/schema"; // Importa el esquema de videos

import { createTRPCRouter, protectedProcedure } from "@/trpc/init"; // Importa utilidades de tRPC

// Creación del router de studio con tRPC
export const playlistsRouter = createTRPCRouter({
  getHistory: protectedProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(), // ID del último video cargado (para paginación)
            viewedAt: z.date(), // Fecha de actualización del último video
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
      })
    )
    .query(async ({ input, ctx }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const viewerVideoViews = db.$with("viewer_video_views").as(
        db
          .select({
            videoId: videoViews.videoId,
            viewedAt: videoViews.updatedAt,
          })
          .from(videoViews)
          .where(eq(videoViews.userId, userId)) // Filtra las vistas del usuario actual
      );

      // Consulta a la base de datos
      const data = await db
        .with(viewerVideoViews)
        .select({
          ...getTableColumns(videos), // Selecciona todas las columnas de la tabla videos
          user: users,
          viewedAt: viewerVideoViews.viewedAt,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)), // Cuenta de vistas del video
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ), // Cuenta de reacciones positivas
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ), // Cuenta de reacciones negativas
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id)) // Une con la tabla de usuarios
        .innerJoin(viewerVideoViews, eq(videos.id, viewerVideoViews.videoId)) // Une con las vistas del usuario
        .where(
          and(
            eq(videos.visibility, "public"), // Solo videos públicos
            cursor
              ? or(
                  // Si hay cursor, aplicar lógica de paginación
                  lt(viewerVideoViews.viewedAt, cursor.viewedAt), // Videos más antiguos que el cursor
                  and(
                    eq(viewerVideoViews.viewedAt, cursor.viewedAt), // O videos con la misma fecha
                    lt(videos.id, cursor.id) // pero ID menor
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewerVideoViews.viewedAt), desc(videos.id)) // Ordenar por fecha de visualización y ID descendente
        .limit(limit + 1); // Obtener un elemento extra para saber si hay más páginas

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            id: lastItem.id,
            viewedAt: lastItem.viewedAt,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      // Retornar resultados y cursor
      return {
        items,
        nextCursor,
      };
    }),

  getLiked: protectedProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(), // ID del último video cargado (para paginación)
            likedAt: z.date(), // Fecha de actualización del último video
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
      })
    )
    .query(async ({ input, ctx }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const viewerVideoReactions = db.$with("viewer_video_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            likedAt: videoReactions.updatedAt,
          })
          .from(videoReactions)
          .where(
            and(
              eq(videoReactions.userId, userId),
              eq(videoReactions.type, "like")
            )
          ) // Filtra las reacciones del usuario actual
      );

      // Consulta a la base de datos
      const data = await db
        .with(viewerVideoReactions)
        .select({
          ...getTableColumns(videos), // Selecciona todas las columnas de la tabla videos
          user: users,
          likedAt: viewerVideoReactions.likedAt,
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)), // Cuenta de vistas del video
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ), // Cuenta de reacciones positivas
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ), // Cuenta de reacciones negativas
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id)) // Une con la tabla de usuarios
        .innerJoin(
          viewerVideoReactions,
          eq(videos.id, viewerVideoReactions.videoId)
        ) // Une con las vistas del usuario
        .where(
          and(
            eq(videos.visibility, "public"), // Solo videos públicos
            cursor
              ? or(
                  // Si hay cursor, aplicar lógica de paginación
                  lt(viewerVideoReactions.likedAt, cursor.likedAt), // Videos más antiguos que el cursor
                  and(
                    eq(viewerVideoReactions.likedAt, cursor.likedAt), // O videos con la misma fecha
                    lt(videos.id, cursor.id) // pero ID menor
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewerVideoReactions.likedAt), desc(videos.id)) // Ordenar por fecha de visualización y ID descendente
        .limit(limit + 1); // Obtener un elemento extra para saber si hay más páginas

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            id: lastItem.id,
            likedAt: lastItem.likedAt,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      // Retornar resultados y cursor
      return {
        items,
        nextCursor,
      };
    }),
});
