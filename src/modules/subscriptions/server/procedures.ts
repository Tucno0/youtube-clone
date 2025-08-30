import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
import { z } from "zod";

import { subscriptions, users } from "@/db/schema";
import { db } from "@/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

export const subscriptionsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        cursor: z
          .object({
            creatorId: z.string().uuid(), // ID del último video cargado (para paginación)
            updatedAt: z.date(), // Fecha de actualización del último video
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
        // direction: z.enum(["forward", "backward"]).optional(), // Dirección de paginación
      })
    )
    .query(async ({ input, ctx }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      // Consulta a la base de datos
      const data = await db
        .select({
          ...getTableColumns(subscriptions), // Selecciona todas las columnas de la tabla subscriptions
          user: {
            ...getTableColumns(users), // Selecciona todas las columnas de la tabla users
            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id)
            ), // Contar el número de suscriptores del usuario
          },
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.creatorId, users.id))
        .where(
          and(
            eq(subscriptions.viewerId, userId), // Filtrar por el ID del espectador
            cursor
              ? or(
                  // Si hay cursor, aplicar lógica de paginación
                  lt(subscriptions.updatedAt, cursor.updatedAt), // Videos más antiguos que el cursor
                  and(
                    eq(subscriptions.updatedAt, cursor.updatedAt), // O subscriptions con la misma fecha
                    lt(subscriptions.creatorId, cursor.creatorId) // pero ID menor
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.creatorId)) // Ordenar por fecha de actualización y ID descendente
        .limit(limit + 1); // Obtener un elemento extra para saber si hay más páginas

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            creatorId: lastItem.creatorId,
            updatedAt: lastItem.updatedAt,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      // Retornar resultados y cursor
      return {
        items,
        nextCursor,
      };
    }),

  //* Crea una suscripción entre un usuario y un creador
  create: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [createdSubscription] = await db
        .insert(subscriptions)
        .values({ viewerId: ctx.user.id, creatorId: userId })
        .returning();

      return createdSubscription;
    }),

  //* Elimina una suscripción entre un usuario y un creador
  remove: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const [deletedSubscription] = await db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.viewerId, ctx.user.id),
            eq(subscriptions.creatorId, userId)
          )
        )
        .returning();

      return deletedSubscription;
    }),
});
