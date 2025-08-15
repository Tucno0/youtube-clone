# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project: Next.js App Router application with tRPC, Drizzle (Neon), Clerk auth, Tailwind + shadcn/ui, and integrations (Mux, UploadThing, Upstash Redis/Workflow).

Commands
- Install dependencies
  - npm: npm install
  - pnpm: pnpm install
  - yarn: yarn install
  - bun: bun install
- Development server
  - npm run dev
  - Optional: start local webhook tunnel alongside dev (ngrok must be installed):
    - bun run dev:all
    - Or run tunnel only: bun run dev:webhook
- Build
  - npm run build
- Start (after build)
  - npm run start
- Lint
  - npm run lint
- Seed categories (one-off; uses tsx and the scripts/seed-categories.ts file)
  - npx tsx scripts/seed-categories.ts
  - or: bunx tsx scripts/seed-categories.ts
- Tests
  - No test runner configuration detected (no jest/vitest/cypress). Add one before attempting test commands.

High-level architecture
- Next.js (App Router) under src/app
  - Route groups: (auth), (home), (studio)
  - Pages like feed/subscribed, feed/trending, videos/[videoId], search, playlists (history/liked), studio screens
  - API routes in src/app/api/…
    - /api/trpc/[trpc]/route.ts: tRPC HTTP handler
    - /api/uploadthing/*: file upload integration
    - /api/users/webhook, /api/videos/webhook: inbound webhooks (e.g., Clerk, Mux, etc.)
    - /api/videos/workflows/*: Upstash Workflow-driven endpoints
  - Root layout wraps app with providers: ClerkProvider, TRPCProvider, Sonner Toaster
  - Middleware (src/middleware.ts) uses Clerk to protect selected routes (/feed/subscriptions, /playlists/**, /studio/**)
  - next.config.ts restricts remote image hosts (image.mux.com, utfs.io, z8bc00g7g3.ufs.sh)
- tRPC stack (src/trpc)
  - init.ts: createTRPCContext reads Clerk user; sets superjson transformer; defines baseProcedure and protectedProcedure
    - protectedProcedure verifies authenticated Clerk user exists in DB, applies rate limiting via Upstash, and augments ctx with user
  - routers/_app.ts aggregates domain routers from src/modules/*/server/procedures
  - server.tsx: RSC-compatible helpers (createHydrationHelpers), stable query client via cache(), exports trpc and HydrateClient
  - client.tsx, query-client.ts: client setup consumed by TRPCProvider in layout
- Data layer (src/db)
  - drizzle-orm with Neon serverless driver (drizzle(process.env.DATABASE_URL))
  - schema.ts models: users, videos (with Mux fields), categories, comments, video_views, video_reactions, comment_reactions, subscriptions
    - Rich relations via drizzle relations; zod schemas via drizzle-zod (createInsert/Update/SelectSchema)
- Domain modules (src/modules)
  - Feature-oriented structure per domain: server/procedures (tRPC routers), ui/components, ui/sections, ui/views, plus types/constants as needed
  - Notable modules: videos, comments(+reactions), video-views, subscriptions, categories, search, studio, playlist
- Integrations (src/lib)
  - mux.ts: Mux client from env (MUX_TOKEN_ID, MUX_TOKEN_SECRET)
  - uploadthing.ts: typed UploadButton/UploadDropzone bound to app router
  - redis.ts: Upstash Redis client
  - ratelimit.ts: Upstash-based rate limiting (used in protectedProcedure)
  - workflow.ts: Upstash Workflow client (QSTASH_TOKEN)
  - utils.ts: UI/format helpers (cn, formatDuration, snakeCaseToTitle)
- Styling and UI
  - Tailwind (tailwind.config.ts) with uploadthing/tw integration; shadcn/ui components under src/components/ui
  - Global styles at src/app/globals.css

Environment and configuration
- Copy .env.example to .env.local and populate before running build/dev:
  - Clerk: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, …
  - App base URL: NEXT_PUBLIC_APP_URL
  - Database (Neon): DATABASE_URL (+ sslmode=require)
  - Upstash Redis: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
  - Mux: MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET
  - UploadThing: UPLOADTHING_TOKEN
  - Upstash Workflow / QStash: QSTASH_TOKEN, UPSTASH_WORKFLOW_URL, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY
  - Optional model providers: OPENAI_API_KEY, DEEPSEEK_API_KEY
- Webhook tunneling for local development: dev:webhook uses ngrok mapped to port 3000 (update the domain in package.json if needed)

Notes
- Package manager: scripts are compatible with any (npm/pnpm/yarn/bun). Some convenience scripts use bun; translate to your PM if preferred.
- Images: ensure allowed remote hosts align with any content you display; update next.config.ts if needed.
- Database: drizzle-kit is present as a dev dependency, but no CLI scripts are defined here; add scripts if you plan to generate/migrate schema.

