import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        "Missing CLERK_WEBHOOK_SECRET. " +
          "Get it from Clerk Dashboard → Webhooks → your endpoint → Signing Secret, " +
          "then set it in Convex Dashboard → Settings → Environment Variables."
      );
      return new Response("Server misconfiguration: missing CLERK_WEBHOOK_SECRET", { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const body = await req.text();
    const wh = new Webhook(webhookSecret);

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof event;
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } =
        event.data as {
          id: string;
          email_addresses: { email_address: string }[];
          first_name?: string;
          last_name?: string;
          image_url?: string;
        };

      await ctx.runMutation(internal.users.upsertFromClerk, {
        clerkId: id,
        email: email_addresses[0]?.email_address ?? "",
        name: [first_name, last_name].filter(Boolean).join(" ") || undefined,
        imageUrl: image_url,
      });
    } else if (event.type === "user.deleted") {
      const { id } = event.data as { id: string };
      await ctx.runMutation(internal.users.deleteByClerkId, { clerkId: id });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
