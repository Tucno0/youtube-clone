import { DEFAULT_LIMIT } from "@/constants";
import { HydrateClient, trpc } from "@/trpc/server";

import { LikedView } from "@/modules/playlist/ui/views/liked-view";

export const dynamic = "force-dynamic";

const LikedPage = () => {
  void trpc.playlists.getLiked.prefetchInfinite({ limit: DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <LikedView />
    </HydrateClient>
  );
};

export default LikedPage;
