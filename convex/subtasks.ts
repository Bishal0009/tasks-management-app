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

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) return null;

    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(100);

    return subtasks.sort((a, b) => a.order - b.order);
  },
});

export const add = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot add sub-tasks");
    }

    const existing = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(100);

    return await ctx.db.insert("subtasks", {
      taskId: args.taskId,
      title: args.title.trim(),
      completed: false,
      order: existing.length,
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: {
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Sub-task not found");

    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot update sub-tasks");
    }

    await ctx.db.patch(args.subtaskId, { completed: !subtask.completed });
  },
});

export const updateTitle = mutation({
  args: {
    subtaskId: v.id("subtasks"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Sub-task not found");

    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot update sub-tasks");
    }

    await ctx.db.patch(args.subtaskId, { title: args.title.trim() });
  },
});

export const remove = mutation({
  args: {
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const subtask = await ctx.db.get(args.subtaskId);
    if (!subtask) throw new Error("Sub-task not found");

    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot delete sub-tasks");
    }

    await ctx.db.delete(args.subtaskId);
  },
});

export const reorder = mutation({
  args: {
    updates: v.array(v.object({ id: v.id("subtasks"), order: v.number() })),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot reorder sub-tasks");
    }

    for (const { id, order } of args.updates) {
      await ctx.db.patch(id, { order });
    }
  },
});
