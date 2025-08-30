import { ResponsiveModal } from "@/components/responsive-modal";
import { UploadDropzone } from "@/lib/uploadthing";
import { trpc } from "@/trpc/client";

interface BannerUploadModalProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BannerUploadModal = ({
  userId,
  isOpen,
  onOpenChange,
}: BannerUploadModalProps) => {
  const utils = trpc.useUtils();

  const onUploadComplete = async () => {
    utils.users.getOne.invalidate({ id: userId });
    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      title="Upload a Banner"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <UploadDropzone
        endpoint="bannerUploader"
        onClientUploadComplete={onUploadComplete}
      />
    </ResponsiveModal>
  );
};
