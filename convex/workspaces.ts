import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db.get(m.workspaceId);
        return workspace ? { ...workspace, role: m.role } : null;
      })
    );

    return workspaces.filter((w) => w !== null);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("personal"), v.literal("team")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      type: args.type,
      createdAt: Date.now(),
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });

    return workspaceId;
  },
});

export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
      )
      .unique();
    if (!membership) return [];

    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);

    return await Promise.all(
      members.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          name: memberUser?.name ?? memberUser?.email ?? "Unknown",
          email: memberUser?.email ?? "",
          imageUrl: memberUser?.imageUrl,
        };
      })
    );
  },
});
