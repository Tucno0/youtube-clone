import { DEFAULT_LIMIT } from "@/constants";
import { VideosView } from "@/modules/playlist/ui/views/videos-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PlaylistPageProps {
  params: Promise<{ playlistId: string }>;
}

const PlaylistDetailPage = async (props: PlaylistPageProps) => {
  const { playlistId } = await props.params;

  void trpc.playlists.getOne.prefetch({ id: playlistId });
  void trpc.playlists.getVideos.prefetchInfinite({
    playlistId,
    limit: DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <VideosView playlistId={playlistId} />
    </HydrateClient>
  );
};

export default PlaylistDetailPage;
