import { DEFAULT_LIMIT } from "@/constants";
import { PlaylistsView } from "@/modules/playlist/ui/views/playlists-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const PlaylistPage = async () => {
  void trpc.playlists.getMany.prefetchInfinite({
    limit: DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <PlaylistsView />
    </HydrateClient>
  );
};

export default PlaylistPage;
