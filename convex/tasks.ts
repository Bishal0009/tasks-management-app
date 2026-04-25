import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) return null;

    return await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) return null;

    return task;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    statusId: v.id("taskStatuses"),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot create tasks");
    }

    await ctx.runMutation(internal.taskStatuses.seedDefaults, {
      workspaceId: args.workspaceId,
    });

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      title: args.title.trim(),
      statusId: args.statusId,
      priority: args.priority,
      assigneeIds: [],
      labelIds: [],
      createdBy: caller.user._id,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.taskActivity.logActivity, {
      taskId,
      workspaceId: args.workspaceId,
      userId: caller.user._id,
      content: "created this task",
    });

    return taskId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    statusId: v.optional(v.id("taskStatuses")),
    priority: v.optional(priorityValidator),
    startDate: v.optional(v.union(v.number(), v.null())),
    dueDate: v.optional(v.union(v.number(), v.null())),
    assigneeIds: v.optional(v.array(v.id("users"))),
    labelIds: v.optional(v.array(v.id("labels"))),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot edit tasks");
    }

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.workspaceId !== args.workspaceId) throw new Error("Task not in this workspace");

    const patch: Record<string, unknown> = {};
    const activityEntries: string[] = [];

    if (args.title !== undefined) {
      patch.title = args.title.trim();
    }
    if (args.description !== undefined) {
      patch.description = args.description || undefined;
    }
    if (args.statusId !== undefined && args.statusId !== task.statusId) {
      const oldStatus = await ctx.db.get(task.statusId);
      const newStatus = await ctx.db.get(args.statusId);
      patch.statusId = args.statusId;
      activityEntries.push(
        `changed status from "${oldStatus?.name ?? "unknown"}" to "${newStatus?.name ?? "unknown"}"`
      );
    }
    if (args.priority !== undefined && args.priority !== task.priority) {
      activityEntries.push(
        `changed priority from "${task.priority}" to "${args.priority}"`
      );
      patch.priority = args.priority;
    }
    if (args.startDate !== undefined) {
      patch.startDate = args.startDate ?? undefined;
    }
    if (args.dueDate !== undefined) {
      patch.dueDate = args.dueDate ?? undefined;
    }
    if (args.assigneeIds !== undefined) {
      patch.assigneeIds = args.assigneeIds;
    }
    if (args.labelIds !== undefined) {
      patch.labelIds = args.labelIds;
    }

    await ctx.db.patch(args.taskId, patch as any);

    for (const entry of activityEntries) {
      await ctx.runMutation(internal.taskActivity.logActivity, {
        taskId: args.taskId,
        workspaceId: args.workspaceId,
        userId: caller.user._id,
        content: entry,
      });
    }
  },
});

export const remove = mutation({
  args: {
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.workspaceId !== args.workspaceId) throw new Error("Task not in this workspace");

    const { role } = caller.membership;
    const isCreator = task.createdBy === caller.user._id;
    const isPrivileged = role === "owner" || role === "admin";

    if (!isCreator && !isPrivileged) {
      throw new Error("Only the task creator, admins, and owners can delete tasks");
    }

    // Delete subtasks
    const subtasks = await ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(100);
    for (const s of subtasks) await ctx.db.delete(s._id);

    // Delete activity
    const activity = await ctx.db
      .query("taskActivity")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(200);
    for (const a of activity) await ctx.db.delete(a._id);

    // Delete attachments and storage files
    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(50);
    for (const att of attachments) {
      await ctx.storage.delete(att.storageId);
      await ctx.db.delete(att._id);
    }

    await ctx.db.delete(args.taskId);
  },
});
