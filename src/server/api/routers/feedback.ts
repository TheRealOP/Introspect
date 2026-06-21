import { TRPCError } from "@trpc/server";

import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { listFeedback } from "~/server/db/users-client";

const ADMIN_EMAIL = env.FEEDBACK_TO ?? "ojaspolakhare@gmail.com";

export const feedbackRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return listFeedback();
  }),
});
