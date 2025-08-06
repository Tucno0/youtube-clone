"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";

import { CommentForm } from "@/modules/comments/ui/components/comment-form";
import { CommentItem } from "@/modules/comments/ui/components/comment-item";

interface CommentSectionProps {
  videoId: string;
}

export const CommentsSection = ({ videoId }: CommentSectionProps) => {
  return (
    <Suspense fallback={<div>Loading comments...</div>}>
      <ErrorBoundary fallback={<div>Failed to load comments</div>}>
        <CommentsSectionSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

export const CommentsSectionSuspense = ({ videoId }: CommentSectionProps) => {
  const [comments] = trpc.comments.getMany.useSuspenseQuery({
    videoId,
  });

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-6">
        <h1>0 Comments</h1>

        <CommentForm videoId={videoId} onSuccess={() => {}} />
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
};
