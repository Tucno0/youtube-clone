// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { users, videoReactions, videos, videoViews } from "@/db/schema"; // Importa el esquema de videos
import { baseProcedure, createTRPCRouter } from "@/trpc/init"; // Importa utilidades de tRPC
import { TRPCError } from "@trpc/server";
import { eq, and, or, lt, desc, getTableColumns } from "drizzle-orm"; // Operadores de consulta de DrizzleORM
import { z } from "zod"; // Librería para validación de esquemas

// Creación del router de sugerencias con tRPC
export const suggestionsRouter = createTRPCRouter({
  // Definición del procedimiento 'getMany' que obtiene múltiples sugerencias
  getMany: baseProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        videoId: z.string().uuid(), // ID del video para el cual se buscan sugerencias
        cursor: z
          .object({
            id: z.string().uuid(), // ID del último video cargado (para paginación)
            updatedAt: z.date(), // Fecha de actualización del último video
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
      })
    )
    .query(async ({ input }) => {
      // Extracción de parámetros
      const { videoId, cursor, limit } = input;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));

      if (!existingVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      // Consulta a la base de datos
      const data = await db
        .select({
          ...getTableColumns(videos), // Selecciona todas las columnas del esquema de videos
          user: users, // Selecciona todas las columnas del esquema de usuarios
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
        .innerJoin(users, eq(users.id, videos.userId)) // Une con la tabla de usuarios
        .where(
          and(
            existingVideo.categoryId
              ? eq(videos.categoryId, existingVideo.categoryId) // Si hay categoría, filtrar por ella para los videos de sugerencias
              : undefined,
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
