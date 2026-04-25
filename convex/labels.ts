import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

async function getCallerMembership(
  ctx: GenericQueryCtx<DataModel>,
  workspaceId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) return null;

  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_and_user", (q) =>
      q.eq("workspaceId", workspaceId as any).eq("userId", user._id)
    )
    .unique();

  return membership ? { user, membership } : null;
}

export const listForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) return null;

    return await ctx.db
      .query("labels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot create labels");
    }

    return await ctx.db.insert("labels", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      color: args.color,
    });
  },
});

export const update = mutation({
  args: {
    labelId: v.id("labels"),
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    if (role !== "owner" && role !== "admin") {
      throw new Error("Only owners and admins can update labels");
    }

    const label = await ctx.db.get(args.labelId);
    if (!label || label.workspaceId !== args.workspaceId) {
      throw new Error("Label not found");
    }

    const patch: { name?: string; color?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.color !== undefined) patch.color = args.color;

    await ctx.db.patch(args.labelId, patch);
  },
});

export const remove = mutation({
  args: {
    labelId: v.id("labels"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    if (role !== "owner" && role !== "admin") {
      throw new Error("Only owners and admins can delete labels");
    }

    const label = await ctx.db.get(args.labelId);
    if (!label || label.workspaceId !== args.workspaceId) {
      throw new Error("Label not found");
    }

    await ctx.db.delete(args.labelId);
  },
});
