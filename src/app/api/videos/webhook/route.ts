import { eq } from "drizzle-orm";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from "@mux/mux-node/resources/webhooks";
import { headers } from "next/headers";
import { mux } from "@/lib/mux";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { UTApi } from "uploadthing/server";

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET;

type WebhookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export const POST = async (request: Request) => {
  if (!SIGNING_SECRET) {
    throw new Error("MUX_WEBHOOK_SECRET is not set");
  }

  const headersPayload = await headers();
  const muxSignature = headersPayload.get("mux-signature");

  if (!muxSignature) {
    return new Response("mux-signature header is missing", { status: 401 });
  }

  const payload = await request.json();
  const body = JSON.stringify(payload);

  mux.webhooks.verifySignature(
    body,
    {
      "mux-signature": muxSignature,
    },
    SIGNING_SECRET
  );

  switch (payload.type as WebhookEvent["type"]) {
    case "video.asset.created":
      const data = payload.data as VideoAssetCreatedWebhookEvent["data"];

      console.log("Created data", data);

      if (!data.upload_id) {
        return new Response("upload_id is missing", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxAssetId: data.id,
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));

      break;

    case "video.asset.ready":
      const readyData = payload.data as VideoAssetReadyWebhookEvent["data"];
      const playbackId = readyData.playback_ids?.[0].id;

      console.log("Ready data", readyData);

      if (!readyData.upload_id) {
        return new Response("upload_id is missing", { status: 400 });
      }

      if (!playbackId) {
        return new Response("playback_id is missing", { status: 400 });
      }

      const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      const tempPreviewUrl = `https://image.mux.com/${playbackId}/animated.gif`;
      const duration = readyData.duration
        ? Math.round(readyData.duration * 1000)
        : 0;

      const utapi = new UTApi();
      const [uploadedThumbnail, uploadedPreview] =
        await utapi.uploadFilesFromUrl([tempThumbnailUrl, tempPreviewUrl]);

      if (!uploadedThumbnail.data || !uploadedPreview.data) {
        return new Response("Failed to upload thumbnail or preview", {
          status: 500,
        });
      }

      const { key: thumbnailKey, ufsUrl: thumbnailUrl } =
        uploadedThumbnail.data;
      const { key: previewKey, ufsUrl: previewUrl } = uploadedPreview.data;

      await db
        .update(videos)
        .set({
          muxStatus: readyData.status,
          muxPlaybackId: playbackId,
          muxAssetId: readyData.id,
          thumbnailUrl,
          thumbnailKey,
          previewUrl,
          previewKey,
          duration,
        })
        .where(eq(videos.muxUploadId, readyData.upload_id));

      break;

    case "video.asset.errored":
      const erroredData = payload.data as VideoAssetErroredWebhookEvent["data"];

      console.log("Errored data", erroredData);

      if (!erroredData.upload_id) {
        return new Response("upload_id is missing", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxStatus: erroredData.status,
        })
        .where(eq(videos.muxUploadId, erroredData.upload_id));

      break;

    case "video.asset.deleted":
      const deletedData = payload.data as VideoAssetDeletedWebhookEvent["data"];

      console.log("Deleted data", deletedData);

      if (!deletedData.upload_id) {
        return new Response("upload_id is missing", { status: 400 });
      }

      await db
        .delete(videos)
        .where(eq(videos.muxUploadId, deletedData.upload_id));

      break;

    case "video.asset.track.ready":
      const trackReadyData =
        payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
          asset_id: string;
        };

      console.log("Track ready data", trackReadyData);

      const assetId = trackReadyData.asset_id;
      const trackId = trackReadyData.id;
      const status = trackReadyData.status;

      if (!assetId) {
        return new Response("upload_id is missing", { status: 400 });
      }

      await db
        .update(videos)
        .set({
          muxTrackId: trackId,
          muxTrackStatus: status,
        })
        .where(eq(videos.muxAssetId, assetId));

      break;

    default:
      break;
  }

  return new Response("Webhook receibed", { status: 200 });
};

// 10:06:15
