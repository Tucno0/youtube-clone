"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";

import { CommentForm } from "@/modules/comments/ui/components/comment-form";
import { CommentItem } from "@/modules/comments/ui/components/comment-item";
import { DEFAULT_LIMIT } from "@/constants";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { Loader2Icon } from "lucide-react";

interface CommentSectionProps {
  videoId: string;
}

export const CommentsSection = ({ videoId }: CommentSectionProps) => {
  return (
    <Suspense fallback={<CommentsSectionSkeleton />}>
      <ErrorBoundary fallback={<div>Failed to load comments</div>}>
        <CommentsSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

export const CommentsSectionSuspense = ({ videoId }: CommentSectionProps) => {
  const [comments, query] = trpc.comments.getMany.useSuspenseInfiniteQuery(
    {
      videoId,
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold">
          {comments.pages[0].totalCount} Comments
        </h1>

        <CommentForm videoId={videoId} onSuccess={() => {}} />
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {comments.pages
          .flatMap((page) => page.items)
          .map((comment) => (
            <CommentItem key={comment.id} comment={comment} variant="comment" />
          ))}

        <InfiniteScroll
          isManual
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
        />
      </div>
    </div>
  );
};

const CommentsSectionSkeleton = () => {
  return (
    <div className="mt-6 flex justify-center items-center">
      <Loader2Icon className="text-muted-foreground size-7 animate-spin" />
    </div>
  );
};
