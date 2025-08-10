import { createTRPCRouter } from "../init";

import { categoriesRouter } from "@/modules/categories/server/procedures";
import { commentReactionsRouter } from "@/modules/comment-reactions/server/procedures";
import { commentsRouter } from "@/modules/comments/server/procedures";
import { searchRouter } from "@/modules/search/server/procedures";
import { studioRouter } from "@/modules/studio/server/procedures";
import { subscriptionsRouter } from "@/modules/subscriptions/server/procedures";
import { suggestionsRouter } from "@/modules/suggestions/server/procedures";
import { videoReactionsRouter } from "@/modules/video-reactions/server/procedures";
import { videosRouter } from "@/modules/videos/server/procedures";
import { videoViewsRouter } from "@/modules/video-views/server/procedures";

export const appRouter = createTRPCRouter({
  categories: categoriesRouter,
  commentReactions: commentReactionsRouter,
  comments: commentsRouter,
  search: searchRouter,
  studio: studioRouter,
  subscriptions: subscriptionsRouter,
  suggestions: suggestionsRouter,
  videoReactions: videoReactionsRouter,
  videos: videosRouter,
  videoViews: videoViewsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
