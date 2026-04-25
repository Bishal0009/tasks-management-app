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

    return await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(50);
  },
});

export const generateUploadUrl = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot upload files");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const caller = await getCallerMembership(ctx, task.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    if (caller.membership.role === "viewer") {
      throw new Error("Viewers cannot save attachments");
    }

    return await ctx.db.insert("taskAttachments", {
      taskId: args.taskId,
      workspaceId: task.workspaceId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      uploadedBy: caller.user._id,
      uploadedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    attachmentId: v.id("taskAttachments"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");
    if (attachment.workspaceId !== args.workspaceId) {
      throw new Error("Attachment not in this workspace");
    }

    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) throw new Error("Unauthenticated");

    const { role } = caller.membership;
    const isUploader = attachment.uploadedBy === caller.user._id;
    const isPrivileged = role === "owner" || role === "admin";

    if (!isUploader && !isPrivileged) {
      throw new Error("Only the uploader, admins, and owners can delete attachments");
    }

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);
  },
});
