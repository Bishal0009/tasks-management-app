import { AuthConfig } from "convex/server";

if (!process.env.CLERK_JWT_ISSUER_DOMAIN) {
  throw new Error(
    "Missing CLERK_JWT_ISSUER_DOMAIN. " +
      "Get it from Clerk Dashboard → JWT Templates → convex → Issuer URL, " +
      "then set it in Convex Dashboard → Settings → Environment Variables."
  );
}

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
