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

  taskStatuses: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
    order: v.number(),
  })
    .index("by_workspace", ["workspaceId"]),

  labels: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
  })
    .index("by_workspace", ["workspaceId"]),

  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.optional(v.string()),
    statusId: v.id("taskStatuses"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    startDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    assigneeIds: v.array(v.id("users")),
    labelIds: v.array(v.id("labels")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "statusId"]),

  subtasks: defineTable({
    taskId: v.id("tasks"),
    title: v.string(),
    completed: v.boolean(),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"]),

  taskActivity: defineTable({
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    type: v.union(v.literal("comment"), v.literal("activity")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"]),

  taskAttachments: defineTable({
    taskId: v.id("tasks"),
    workspaceId: v.id("workspaces"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  })
    .index("by_task", ["taskId"]),
});
