// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { users, videoReactions, videos, videoViews } from "@/db/schema"; // Importa el esquema de videos
import { baseProcedure, createTRPCRouter } from "@/trpc/init"; // Importa utilidades de tRPC
import { eq, and, or, lt, desc, ilike, getTableColumns } from "drizzle-orm"; // Operadores de consulta de DrizzleORM
import { z } from "zod"; // Librería para validación de esquemas

// Creación del router de búsqueda con tRPC
export const searchRouter = createTRPCRouter({
  // Definición del procedimiento 'getMany' que obtiene múltiples videos
  getMany: baseProcedure // Procedimiento protegido (requiere autenticación)
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        query: z.string().nullish(), // Consulta de búsqueda
        categoryId: z.string().uuid().nullish(), // ID de la categoría (opcional)
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
      const { cursor, limit, query, categoryId } = input;

      // Consulta a la base de datos
      const data = await db
        .select({
          ...getTableColumns(videos), // Selecciona todas las columnas de la tabla videos
          user: users,
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
        .innerJoin(users, eq(videos.userId, users.id))
        .where(
          and(
            eq(videos.visibility, "public"), // Solo videos públicos
            ilike(videos.title, `%${query}%`), // Filtrar por título que contenga la consulta
            categoryId ? eq(videos.categoryId, categoryId) : undefined, // Filtrar por categoría si se proporciona
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
