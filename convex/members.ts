import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer")
);

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

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const caller = await getCallerMembership(ctx, args.workspaceId);
    if (!caller) return null;

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;
        return {
          userId: user._id,
          name: user.name ?? user.email,
          email: user.email,
          imageUrl: user.imageUrl,
          role: m.role,
          joinedAt: m.joinedAt,
        };
      })
    );

    return members.filter((m) => m !== null);
  },
});

export const updateRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
    newRole: roleValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", callerUser._id)
      )
      .unique();
    if (!callerMembership) throw new Error("Not a member of this workspace");

    const callerRole = callerMembership.role;
    if (callerRole !== "owner" && callerRole !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.targetUserId)
      )
      .unique();
    if (!targetMembership) throw new Error("Target user is not a member");

    // Admins can only manage member/viewer roles
    if (callerRole === "admin") {
      if (
        targetMembership.role === "owner" ||
        targetMembership.role === "admin" ||
        args.newRole === "owner" ||
        args.newRole === "admin"
      ) {
        throw new Error("Admins can only change member/viewer roles");
      }
    }

    // Prevent sole owner from demoting themselves
    if (targetMembership.role === "owner" && args.newRole !== "owner") {
      const ownerCount = (
        await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .collect()
      ).filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) throw new Error("Cannot demote the sole owner");
    }

    await ctx.db.patch(targetMembership._id, { role: args.newRole });
  },
});

export const remove = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", callerUser._id)
      )
      .unique();
    if (!callerMembership) throw new Error("Not a member of this workspace");

    const callerRole = callerMembership.role;
    if (callerRole !== "owner" && callerRole !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const targetMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.targetUserId)
      )
      .unique();
    if (!targetMembership) throw new Error("Target user is not a member");

    // Admins can only remove member/viewer
    if (
      callerRole === "admin" &&
      (targetMembership.role === "owner" || targetMembership.role === "admin")
    ) {
      throw new Error("Admins can only remove members or viewers");
    }

    // Prevent sole owner from removing themselves
    if (args.targetUserId === callerUser._id && targetMembership.role === "owner") {
      const ownerCount = (
        await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .collect()
      ).filter((m) => m.role === "owner").length;
      if (ownerCount <= 1) throw new Error("Cannot remove the sole owner");
    }

    await ctx.db.delete(targetMembership._id);
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.optional(
      v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"))
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const callerUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!callerUser) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", callerUser._id)
      )
      .unique();
    if (!callerMembership) throw new Error("Not a member of this workspace");

    if (callerMembership.role !== "owner" && callerMembership.role !== "admin") {
      throw new Error("Only owners and admins can invite members");
    }

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();
    if (!targetUser) throw new Error("No account found with that email address");

    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", targetUser._id)
      )
      .unique();
    if (existing) throw new Error("User is already a member of this workspace");

    await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: targetUser._id,
      role: args.role ?? "member",
      joinedAt: Date.now(),
    });
  },
});
