// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { videos, videoUpdateSchema } from "@/db/schema"; // Importa el esquema de videos
import { mux } from "@/lib/mux";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init"; // Importa utilidades de tRPC
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

// Creación del router de studio con tRPC
export const videosRouter = createTRPCRouter({
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

  update: protectedProcedure
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

  remove: protectedProcedure
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

  restoreThumbnail: protectedProcedure
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
});
