import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { and, eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

// curl -X POST http://localhost:3000/api/videos/workflows/title

interface InputType {
  userId: string;
  videoId: string;
  prompt: string;
}

export const { POST } = serve(async (context) => {
  const input = context.requestPayload as InputType;
  const { videoId, userId, prompt } = input;
  const utaApi = new UTApi();

  const video = await context.run("get-video", async () => {
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

    if (!existingVideo) {
      throw new Error("Video not found");
    }

    return existingVideo;
  });

  const { body } = await context.call<{ data: Array<{ url: string }> }>(
    "generate-thumbnail",
    {
      url: "https://api.openai.com/v1/images/generations",
      method: "POST",
      body: {
        prompt: prompt,
        n: 1, // Number of images to generate
        model: "dall-e-3",
        size: "1792x1024",
      },
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    }
  );

  const tempThumbnailUrl = body.data[0].url;

  if (!tempThumbnailUrl) {
    throw new Error("Bad request");
  }

  await context.run("cleanup-thumbnail", async () => {
    if (video.thumbnailKey) {
      await utaApi.deleteFiles(video.thumbnailKey);

      await db
        .update(videos)
        .set({ thumbnailKey: null, thumbnailUrl: null })
        .where(and(eq(videos.id, video.id), eq(videos.userId, video.userId)));
    }
  });

  const uploadThumbnail = await context.run("upload-thumbnail", async () => {
    const { data } = await utaApi.uploadFilesFromUrl(tempThumbnailUrl);

    // if (error) {
    //   throw new Error(error.message);
    // }

    if (!data) {
      throw new Error("Bad request");
    }

    return data;
  });

  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        thumbnailKey: uploadThumbnail.key,
        thumbnailUrl: uploadThumbnail.ufsUrl,
      })
      .where(and(eq(videos.id, video.id), eq(videos.userId, video.userId)));
  });
});
