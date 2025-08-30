import { eq, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { subscriptions, users, videos } from "@/db/schema"; // Importa el esquema de videos
import { baseProcedure, createTRPCRouter } from "@/trpc/init"; // Importa utilidades de tRPC
import { TRPCError } from "@trpc/server";

// Creación del router de studio con tRPC
export const usersRouter = createTRPCRouter({
  //* Public procedures
  getOne: baseProcedure // Obtener un video por ID
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const { clerkUserId } = ctx;

      let userId;

      const [user] = await db
        .select()
        .from(users)
        .where(inArray(users.clerkId, clerkUserId ? [clerkUserId] : []));

      if (user) {
        userId = user.id;
      }

      // Common table expresions
      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, userId ? [userId] : []))
      );

      const [existingUser] = await db
        .with(viewerSubscriptions)
        .select({
          ...getTableColumns(users), // Obtener columnas de la tabla de usuarios
          viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
            Boolean
          ), // Ver si el usuario está suscrito al creador
          videoCount: db.$count(videos, eq(videos.userId, users.id)), // Contar el número de videos subidos por el usuario
          subscriberCount: db.$count(
            subscriptions,
            eq(subscriptions.creatorId, users.id)
          ), // Contar el número de suscriptores del usuario
        })
        .from(users)
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id)
        )
        .where(eq(users.id, input.id));

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      return existingUser;
    }),
});
