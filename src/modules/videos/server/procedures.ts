// Importaciones necesarias
import { db } from "@/db"; // Importa la instancia de la base de datos
import { videos } from "@/db/schema"; // Importa el esquema de videos
import { createTRPCRouter, protectedProcedure } from "@/trpc/init"; // Importa utilidades de tRPC
// import { TRPCError } from "@trpc/server";

// Creación del router de studio con tRPC
export const videosRouter = createTRPCRouter({
  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.user; // ID del usuario autenticado

    // throw new TRPCError({
    //   code: "BAD_REQUEST",
    //   message: "This is a test error",
    // });

    const [video] = await db
      .insert(videos) // Insertar en la tabla de videos
      .values({
        // Valores del nuevo video
        userId,
        title: "Untitled",
      })
      .returning(); // Insertar un nuevo video

    return {
      video,
    };
  }),
});
