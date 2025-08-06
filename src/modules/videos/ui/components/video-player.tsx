import MuxPlayer from "@mux/mux-player-react";
import { THUMNAIL_FALLBACK } from "../../constants";

interface VideoPlayerProps {
  playbackId?: string | null | undefined;
  thumbnailUrl?: string | null | undefined;
  autoPlay?: boolean;
  onPlay?: () => void;
}
export const VideoPlayer = ({
  playbackId,
  thumbnailUrl,
  autoPlay,
  onPlay,
}: VideoPlayerProps) => {
  // if (!playbackId) return null;

  return (
    <MuxPlayer
      playbackId={playbackId || ""} // playbackId is required
      poster={thumbnailUrl || THUMNAIL_FALLBACK}
      playerInitTime={0}
      autoPlay={autoPlay}
      thumbnailTime={0}
      className="w-full h-full object-contain"
      accentColor="#FF2056"
      onPlay={onPlay}
    />
  );
};

export const VideoPlayerSkeleton = () => {
  return <div className="aspect-video bg-black rounded-xl" />;
};
