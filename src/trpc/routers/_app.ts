import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { auth } from "@clerk/nextjs/server";

export const appRouter = createTRPCRouter({
  hello: protectedProcedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query(async (opts) => {
      // throw new Error("not implemented");
      const { userId } = await auth();
      console.log(opts.ctx.user);

      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
});

// export type definition of API
export type AppRouter = typeof appRouter;
