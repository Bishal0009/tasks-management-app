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

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) return null;

    const entries = await ctx.db
      .query("taskActivity")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .take(200);

    const withUsers = await Promise.all(
      entries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
          userName: user?.name ?? user?.email ?? "Unknown",
          userImageUrl: user?.imageUrl,
        };
      })
    );

    return withUsers;
  },
});

export const addComment = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot add comments");
    }

    return await ctx.db.insert("taskActivity", {
      taskId: args.taskId,
      workspaceId: task.workspaceId,
      userId: caller.user._id,
      type: "comment",
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const deleteComment = mutation({
  args: {
    activityId: v.id("taskActivity"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.activityId);
    if (!entry) throw new Error("Comment not found");
    if (entry.type !== "comment") throw new Error("Not a comment");

    const caller = await getCallerMembership(ctx, entry.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    const isAuthor = entry.userId === caller.user._id;
    const isPrivileged = role === "owner" || role === "admin";

    if (!isAuthor && !isPrivileged) {
      throw new Error("Only the comment author, admins, and owners can delete comments");
    }

    await ctx.db.delete(args.activityId);
  },
});

export const logActivity = internalMutation({
  args: {
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("taskActivity", {
      taskId: args.taskId,
      workspaceId: args.workspaceId,
      userId: args.userId,
      type: "activity",
      content: args.content,
      createdAt: Date.now(),
    });
  },
});
