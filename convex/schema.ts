import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  workspaces: defineTable({
    name: v.string(),
    type: v.union(v.literal("personal"), v.literal("team")),
    createdAt: v.number(),
  }),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_and_user", ["workspaceId", "userId"]),

  invitations: defineTable({
    workspaceId: v.id("workspaces"),
    invitedEmail: v.string(),
    invitedBy: v.id("users"),
    token: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked")
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_workspace_and_status", ["workspaceId", "status"])
    .index("by_workspace_and_email_and_status", ["workspaceId", "invitedEmail", "status"]),
});
