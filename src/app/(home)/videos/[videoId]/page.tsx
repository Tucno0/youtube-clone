import { VideoView } from "@/modules/videos/ui/views/video-view";
import { HydrateClient, trpc } from "@/trpc/server";

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { videoId } = await params;

  void trpc.videos.getOne.prefetch({ id: videoId });
  // TODO: don't forget to change to 'prefetchInfinite'
  void trpc.comments.getMany.prefetch({ videoId });

  return (
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
}
