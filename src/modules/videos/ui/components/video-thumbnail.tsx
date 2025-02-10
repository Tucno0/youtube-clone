import { formatDuration } from "@/lib/utils";
import Image from "next/image";

interface VideoThumbnailProps {
  title?: string;
  duration: number;
  imageUrl?: string | null;
  previewUrl?: string | null;
}

export const VideoThumbnail = ({
  title,
  duration,
  imageUrl,
  previewUrl,
}: VideoThumbnailProps) => {
  return (
    <div className="relative group">
      {/* Thumbnail wrapper */}
      <div className="">
        <div className="relative w-full overflow-hidden rounded-xl aspect-video">
          <Image
            title={title}
            src={imageUrl ?? "/placeholder.svg"}
            alt="Video thumbnail"
            fill
            className="h-full w-full object-cover group-hover:opacity-0"
          />

          <Image
            unoptimized={!!previewUrl}
            title={title}
            src={previewUrl ?? "/placeholder.svg"}
            alt="Video thumbnail"
            fill
            className="h-full w-full object-cover opacity-0 group-hover:opacity-100"
          />
        </div>
      </div>

      {/* Video duration box */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs font-medium px-1 py-0.5 rounded">
        {formatDuration(duration)}
      </div>
    </div>
  );
};
