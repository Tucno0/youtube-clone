import { cn } from "@/lib/utils";
import { UserGetOneOutput } from "../../types";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Edit2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BannerUploadModal } from "./banner-upload-modal";
import { useState } from "react";

interface UserPageBannerProps {
  user: UserGetOneOutput;
}

export const UserPageBanner = ({ user }: UserPageBannerProps) => {
  const { userId } = useAuth();

  const [isBannerUploadModalOpen, setIsBannerUploadModalOpen] = useState(false);

  return (
    <div className="relative group">
      {/* TODO: Add upload banner modal */}
      <BannerUploadModal
        userId={user.id}
        isOpen={isBannerUploadModalOpen}
        onOpenChange={setIsBannerUploadModalOpen}
      />
      <div
        className={cn(
          "w-full max-h-[200px] h-[15vh] md:h-[25vh] bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl",
          user.bannerUrl ? "bg-cover bg-center" : "bg-gray-100"
        )}
        style={{
          backgroundImage: user.bannerUrl
            ? `url(${user.bannerUrl})`
            : undefined,
        }}
      >
        {userId === user.clerkId && (
          <div className="absolute top-2 right-2">
            <Button
              type="button"
              size={"icon"}
              className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/50 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              onClick={() => setIsBannerUploadModalOpen(true)}
            >
              <Edit2Icon className="size-4 text-white" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export const UserPageBannerSkeleton = () => {
  return (
    <Skeleton className="w-full max-h-[200px] h-[15vh] md:h-[25vh] rounded-xl" />
  );
};
