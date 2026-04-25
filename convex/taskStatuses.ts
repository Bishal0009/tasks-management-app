import { internalMutation, mutation, query } from "./_generated/server";
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

    const statuses = await ctx.db
      .query("taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);

    return statuses.sort((a, b) => a.order - b.order);
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

    const { role } = caller.membership;
    if (role !== "owner" && role !== "admin") {
      throw new Error("Only owners and admins can create statuses");
    }

    const existing = await ctx.db
      .query("taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(50);

    const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), -1);

    return await ctx.db.insert("taskStatuses", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      color: args.color,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    statusId: v.id("taskStatuses"),
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    if (role !== "owner" && role !== "admin") {
      throw new Error("Only owners and admins can update statuses");
    }

    const status = await ctx.db.get(args.statusId);
    if (!status || status.workspaceId !== args.workspaceId) {
      throw new Error("Status not found");
    }

    const patch: { name?: string; color?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.color !== undefined) patch.color = args.color;

    await ctx.db.patch(args.statusId, patch);
  },
});

export const remove = mutation({
  args: {
    statusId: v.id("taskStatuses"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    if (role !== "owner" && role !== "admin") {
      throw new Error("Only owners and admins can delete statuses");
    }

    const status = await ctx.db.get(args.statusId);
    if (!status || status.workspaceId !== args.workspaceId) {
      throw new Error("Status not found");
    }

    const tasksUsingStatus = await ctx.db
      .query("tasks")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("statusId", args.statusId)
      )
      .take(1);

    if (tasksUsingStatus.length > 0) {
      throw new Error("Cannot delete a status that is in use by tasks");
    }

    await ctx.db.delete(args.statusId);
  },
});

export const seedDefaults = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1);

    if (existing.length > 0) return;

    const defaults = [
      { name: "To Do", color: "#94a3b8", order: 0 },
      { name: "In Progress", color: "#3b82f6", order: 1 },
      { name: "In Review", color: "#a855f7", order: 2 },
      { name: "Done", color: "#22c55e", order: 3 },
    ];

    for (const s of defaults) {
      await ctx.db.insert("taskStatuses", {
        workspaceId: args.workspaceId,
        ...s,
      });
    }
  },
});
