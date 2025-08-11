// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import {
  subscriptions,
  users,
  videoReactions,
  videos,
  videoUpdateSchema,
  videoViews,
} from "@/db/schema"; // Importa el esquema de videos
import { mux } from "@/lib/mux";
import { workflow } from "@/lib/workflow";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init"; // Importa utilidades de tRPC
import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  lt,
  or,
} from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

// Creación del router de studio con tRPC
export const videosRouter = createTRPCRouter({
  //* Protected procedures
  // Crear un nuevo video
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user; // ID del usuario autenticado

    // throw new TRPCError({
    //   code: "BAD_REQUEST",
    //   message: "This is a test error",
    // });

    // Crear un nuevo upload en Mux
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        passthrough: userId,
        playback_policy: ["public"],
        input: [
          {
            generated_subtitles: [
              {
                language_code: "en",
                name: "English",
              },
            ],
          },
        ],
      },
      cors_origin: "*", // En producción, esto debería ser la URL de la aplicación
    });

    const [video] = await db
      .insert(videos) // Insertar en la tabla de videos
      .values({
        // Valores del nuevo video
        userId,
        title: "Untitled",
        muxStatus: "waiting",
        muxUploadId: upload.id, // ID de subida de Mux
      })
      .returning(); // Insertar un nuevo video

    return {
      video,
      url: upload.url, // URL de subida de Mux
    };
  }),

  update: protectedProcedure // Actualizar un video
    .input(videoUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      if (!input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video ID is required",
        });
      }

      const [updatedVideo] = await db
        .update(videos)
        .set({
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(videos.id, input.id),
            eq(videos.userId, userId) // Filtrar por ID y usuario
          )
        )
        .returning();

      if (!updatedVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      return updatedVideo;
    }),

  remove: protectedProcedure // Eliminar un video
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [removedVideo] = await db
        .delete(videos)
        .where(
          and(
            eq(videos.id, input.id),
            eq(videos.userId, userId) // Filtrar por ID y usuario
          )
        )
        .returning();

      if (!removedVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      return removedVideo;
    }),

  revalidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.id, input.id),
            eq(videos.userId, userId) // Filtrar por ID y usuario
          )
        );

      if (!existingVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      if (!existingVideo.muxUploadId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video does not have an upload ID",
        });
      }

      const upload = await mux.video.uploads.retrieve(
        existingVideo.muxUploadId
      );

      if (!upload || !upload.asset_id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video is still processing",
        });
      }

      const asset = await mux.video.assets.retrieve(upload.asset_id);

      if (!asset) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video asset not found",
        });
      }

      const playbackId = asset.playback_ids?.[0].id;
      const duration = asset.duration ? Math.round(asset.duration * 1000) : 0;

      // TODO: Potentially find a way to revalidate trackId and trackStatus as well

      const [updatedVideo] = await db
        .update(videos)
        .set({
          muxStatus: asset.status,
          muxPlaybackId: playbackId,
          muxAssetId: asset.id,
          duration,
        })
        .where(and(eq(videos.id, input.id), eq(videos.userId, userId)))
        .returning();

      return updatedVideo;
    }),

  restoreThumbnail: protectedProcedure // Restaurar miniatura de video al original de Mux
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(
          and(
            eq(videos.id, input.id),
            eq(videos.userId, userId) // Filtrar por ID y usuario
          )
        );

      if (!existingVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      if (existingVideo.thumbnailKey) {
        const utaApi = new UTApi();
        utaApi.uploadFilesFromUrl(existingVideo.thumbnailKey);

        await utaApi.deleteFiles(existingVideo.thumbnailKey);

        await db
          .update(videos)
          .set({
            thumbnailUrl: null,
            thumbnailKey: null,
          })
          .where(and(eq(videos.id, input.id), eq(videos.userId, userId)));
      }

      if (!existingVideo.muxPlaybackId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video does not have a playback ID",
        });
      }

      const utapi = new UTApi();

      const tempThumbnailUrl = `https://image.mux.com/${existingVideo.muxPlaybackId}/thumbnail.jpg`;
      const uploadedThumbnail = await utapi.uploadFilesFromUrl(
        tempThumbnailUrl
      );

      if (!uploadedThumbnail.data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upload thumbnail",
        });
      }

      const { key: thumbnailKey, ufsUrl: thumbnailUrl } =
        uploadedThumbnail.data;

      const [updatedVideo] = await db
        .update(videos)
        .set({
          thumbnailUrl,
          thumbnailKey,
        })
        .where(
          and(
            eq(videos.id, input.id),
            eq(videos.userId, userId) // Filtrar por ID y usuario
          )
        )
        .returning();

      return updatedVideo;
    }),

  generateThumbnail: protectedProcedure // Generar miniatura de video con IA
    .input(
      z.object({
        id: z.string().uuid(),
        prompt: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/thumbnail`,
        body: { userId, videoId: input.id, prompt: input.prompt },
        retries: 3,
      });

      return workflowRunId;
    }),

  generateTitle: protectedProcedure // Generar título de video con IA
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/title`,
        body: { userId, videoId: input.id },
        retries: 3,
      });

      return workflowRunId;
    }),

  generateDescription: protectedProcedure // Generar descripción de video con IA
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.user;

      const { workflowRunId } = await workflow.trigger({
        url: `${process.env.UPSTASH_WORKFLOW_URL}/api/videos/workflows/description`,
        body: { userId, videoId: input.id },
        retries: 3,
      });

      return workflowRunId;
    }),

  getManySubscribed: protectedProcedure
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
    .query(async ({ input, ctx }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select({
            userId: subscriptions.creatorId,
          })
          .from(subscriptions)
          .where(eq(subscriptions.viewerId, userId))
      );

      // Consulta a la base de datos
      const data = await db
        .with(viewerSubscriptions)
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
        .innerJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.userId, users.id)
        )
        .where(
          and(
            eq(videos.visibility, "public"), // Solo videos públicos
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
      const viewerReactions = db.$with("viewer_reactions").as(
        db
          .select({
            videoId: videoReactions.videoId,
            type: videoReactions.type,
          })
          .from(videoReactions)
          .where(inArray(videoReactions.userId, userId ? [userId] : []))
      );

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, userId ? [userId] : []))
      );

      const [existingVideo] = await db
        .with(viewerReactions, viewerSubscriptions)
        .select({
          ...getTableColumns(videos), // Obtener columnas de la tabla de videos
          user: {
            ...getTableColumns(users), // Obtener columnas de la tabla de usuarios
            subscriberCount: db.$count(
              subscriptions,
              eq(subscriptions.creatorId, users.id)
            ), // Contar suscriptores del creador
            viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
              Boolean
            ), // Ver si el usuario está suscrito al creador
          },
          viewCount: db.$count(videoViews, eq(videoViews.videoId, videos.id)), // Contar vistas del video
          likeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "like")
            )
          ), // Contar likes del video
          dislikeCount: db.$count(
            videoReactions,
            and(
              eq(videoReactions.videoId, videos.id),
              eq(videoReactions.type, "dislike")
            )
          ), // Contar dislikes del video
          viewerReaction: viewerReactions.type, // Reacción del usuario
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .leftJoin(viewerReactions, eq(viewerReactions.videoId, videos.id))
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id)
        )
        .where(eq(videos.id, input.id));
      // .groupBy(videos.id, users.id, viewerReactions.type);
      // .limit(1);

      if (!existingVideo) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video not found",
        });
      }

      return existingVideo;
    }),

  getMany: baseProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
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
      const { cursor, limit, categoryId } = input;

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

  getManyTrending: baseProcedure
    .input(
      // Definición del esquema de entrada usando Zod
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(), // ID del último video cargado (para paginación)
            viewCount: z.number(), // Contador de vistas
          })
          .nullish(), // El cursor es opcional
        limit: z.number().min(1).max(100), // Límite de resultados por consulta
      })
    )
    .query(async ({ input }) => {
      // Extracción de parámetros
      const { cursor, limit } = input;

      const viewCountSubquery = db.$count(
        videoViews,
        eq(videoViews.videoId, videos.id)
      );

      // Consulta a la base de datos
      const data = await db
        .select({
          ...getTableColumns(videos), // Selecciona todas las columnas de la tabla videos
          user: users,
          viewCount: viewCountSubquery, // Cuenta de vistas del video
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
            cursor
              ? or(
                  // Si hay cursor, aplicar lógica de paginación
                  lt(viewCountSubquery, cursor.viewCount), // Se compara la cantidad de vistas con el cursor
                  and(
                    eq(viewCountSubquery, cursor.viewCount), // Se compara la cantidad de vistas con el cursor
                    lt(videos.id, cursor.id) // pero ID menor
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(viewCountSubquery), desc(videos.id)) // Ordenar por cantidad de vistas y ID descendente
        .limit(limit + 1); // Obtener un elemento extra para saber si hay más páginas

      const hasMore = data.length > limit; // Verificar si hay más páginas

      const items = hasMore ? data.slice(0, -1) : data; // Eliminar el elemento extra si hay más páginas

      const lastItem = items[items.length - 1]; // Obtener el último elemento
      const nextCursor = hasMore // Si hay más páginas, crear cursor con el último elemento
        ? {
            id: lastItem.id,
            viewCount: lastItem.viewCount,
          } // Crear cursor con el último elemento
        : null; // No hay más páginas

      // Retornar resultados y cursor
      return {
        items,
        nextCursor,
      };
    }),
});
