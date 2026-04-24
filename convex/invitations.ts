import {
  internalAction,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Resend } from "resend";

export const getInviteEmailData = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.invitationId);
    if (!invite || invite.status !== "pending") return null;

    const workspace = await ctx.db.get(invite.workspaceId);
    const inviter = await ctx.db.get(invite.invitedBy);

    return {
      token: invite.token,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      workspaceName: workspace?.name ?? "a workspace",
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
    };
  },
});

export const createInvitation = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller) throw new Error("User not found");

    const callerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", caller._id)
      )
      .unique();
    if (
      !callerMembership ||
      (callerMembership.role !== "owner" && callerMembership.role !== "admin")
    ) {
      throw new Error("Unauthorized: must be owner or admin");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.type === "personal") {
      throw new Error("Cannot invite to a personal workspace");
    }

    const email = args.email.toLowerCase().trim();

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (targetUser) {
      const existingMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_and_user", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", targetUser._id)
        )
        .unique();
      if (existingMembership) throw new Error("already_member");
    }

    const pendingInvite = await ctx.db
      .query("invitations")
      .withIndex("by_workspace_and_email_and_status", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("invitedEmail", email)
          .eq("status", "pending")
      )
      .first();

    if (pendingInvite) {
      if (pendingInvite.expiresAt > Date.now()) {
        throw new Error("invite_already_sent");
      }
      await ctx.db.patch(pendingInvite._id, { status: "revoked" });
    }

    const token = crypto.randomUUID();
    const invitationId = await ctx.db.insert("invitations", {
      workspaceId: args.workspaceId,
      invitedEmail: email,
      invitedBy: caller._id,
      token,
      role: args.role,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.invitations.sendInviteEmail, {
      invitationId,
    });

    return { token };
  },
});

export const sendInviteEmail = internalAction({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const data: {
      token: string;
      invitedEmail: string;
      role: string;
      workspaceName: string;
      inviterName: string;
    } | null = await ctx.runQuery(internal.invitations.getInviteEmailData, {
      invitationId: args.invitationId,
    });
    if (!data) return;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteLink = `${appUrl}/invite/${data.token}`;

    await resend.emails.send({
      from: "Tasks App <onboarding@resend.dev>",
      to: data.invitedEmail,
      subject: `You've been invited to join ${data.workspaceName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 16px;">You've been invited to a workspace</h2>
          <p style="color:#555;margin:0 0 24px;">
            <strong>${data.inviterName}</strong> has invited you to join
            <strong>${data.workspaceName}</strong> as a
            <strong>${data.role}</strong>.
          </p>
          <a href="${inviteLink}"
            style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Accept Invitation
          </a>
          <p style="color:#999;font-size:13px;margin:16px 0 0;">
            Or copy this link: ${inviteLink}
          </p>
          <p style="color:#999;font-size:13px;margin:8px 0 0;">
            This invitation expires in 7 days.
          </p>
        </div>
      `,
    });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) return null;

    const workspace = await ctx.db.get(invite.workspaceId);
    const inviter = await ctx.db.get(invite.invitedBy);

    return {
      workspaceId: invite.workspaceId,
      workspaceName: workspace?.name ?? "a workspace",
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
    };
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) throw new Error("Invitation not found");
    if (invite.status !== "pending") throw new Error("Invitation is no longer valid");
    if (invite.expiresAt < Date.now()) throw new Error("Invitation has expired");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existingMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", user._id)
      )
      .unique();
    if (existingMembership) throw new Error("already_member");

    await ctx.db.insert("workspaceMembers", {
      workspaceId: invite.workspaceId,
      userId: user._id,
      role: invite.role,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(invite._id, { status: "accepted" });

    return { workspaceId: invite.workspaceId };
  },
});

export const listPendingForWorkspace = query({
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
    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      return [];
    }

    const now = Date.now();
    const pending = await ctx.db
      .query("invitations")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "pending")
      )
      .take(100);

    const active = pending.filter((inv) => inv.expiresAt > now);

    return await Promise.all(
      active.map(async (inv) => {
        const inviter = await ctx.db.get(inv.invitedBy);
        return {
          _id: inv._id,
          invitedEmail: inv.invitedEmail,
          role: inv.role,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          inviterName: inviter?.name ?? inviter?.email ?? "Someone",
        };
      })
    );
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db.get(args.invitationId);
    if (!invite) throw new Error("Invitation not found");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller) throw new Error("User not found");

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", invite.workspaceId).eq("userId", caller._id)
      )
      .unique();
    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.invitationId, { status: "revoked" });
  },
});
