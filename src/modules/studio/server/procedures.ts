// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { videos } from "@/db/schema"; // Importa el esquema de videos
import { createTRPCRouter, protectedProcedure } from "@/trpc/init"; // Importa utilidades de tRPC
import { TRPCError } from "@trpc/server";
import { eq, and, or, lt, desc } from "drizzle-orm"; // Operadores de consulta de DrizzleORM
import { z } from "zod"; // Librería para validación de esquemas

// Creación del router de studio con tRPC
export const studioRouter = createTRPCRouter({
  getOne: protectedProcedure // Procedimiento protegido (requiere autenticación)
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        id: z.string().uuid(), // ID del video a obtener
      })
    )
    .query(async ({ ctx, input }) => {
      const { id: userId } = ctx.user; // ID del usuario autenticado

      // Extracción de parámetros
      const { id } = input;

      // Consulta a la base de datos
      const [video] = await db
        .select()
        .from(videos)
        .where(and(eq(videos.id, id), eq(videos.userId, userId))) // Filtrar por ID y usuario
        .limit(1); // Obtener un solo resultado

      // Verificar si el video existe
      if (!video) {
        // Si no existe, lanzar error 404
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      // Retornar el video
      return video;
    }),

  // Definición del procedimiento 'getMany' que obtiene múltiples videos
  getMany: protectedProcedure // Procedimiento protegido (requiere autenticación)
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(), // ID del último video cargado (para paginación)
            updatedAt: z.date(), // Fecha de actualización del último video
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
      })
    )
    .query(async ({ ctx, input }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;
      const { id: userId } = ctx.user; // ID del usuario autenticado

      // Consulta a la base de datos
      const data = await db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.userId, userId), // Filtrar por el usuario actual
            cursor
              ? or(
                  // Si hay cursor, aplicar lógica de paginación
                  lt(videos.updatedAt, cursor.updatedAt), // Videos más antiguos que el cursor
                  and(
                    eq(videos.updatedAt, cursor.updatedAt), // O videos con la misma fecha
                    lt(videos.id, cursor.id) // pero ID menor
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id)) // Ordenar por fecha de actualización y ID descendente
        .limit(limit + 1); // Obtener un elemento extra para saber si hay más páginas

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      // Retornar resultados y cursor
      return {
        items,
        nextCursor,
      };
    }),
});
