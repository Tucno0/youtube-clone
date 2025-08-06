import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { comments, users } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";

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
      })
    )
    .query(async ({ input }) => {
      const { videoId } = input;

      const data = await db
        .select({
          ...getTableColumns(comments),
          user: getTableColumns(users),
        })
        .from(comments)
        .where(eq(comments.videoId, videoId))
        .innerJoin(users, eq(comments.userId, users.id));

      return data;
    }),
});
