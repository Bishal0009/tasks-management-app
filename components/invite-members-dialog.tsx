"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
}

export function InviteMembersDialog({ open, onOpenChange, workspaceId }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvitation = useMutation(api.invitations.createInvitation);
  const revokeInvitation = useMutation(api.invitations.revokeInvitation);
  const pending = useQuery(api.invitations.listPendingForWorkspace, { workspaceId });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await createInvitation({ workspaceId, email, role });
      setInviteToken(result.token);
      setEmail("");
      toast.success("Invitation sent!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("already_member")) {
        setError("This person is already a member of the workspace.");
      } else if (msg.includes("invite_already_sent")) {
        setError("An active invitation has already been sent to this email.");
      } else {
        setError("Failed to send invitation. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(`${appUrl}/invite/${inviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke(invitationId: Id<"invitations">) {
    try {
      await revokeInvitation({ invitationId });
      toast.success("Invitation revoked.");
    } catch {
      toast.error("Failed to revoke invitation.");
    }
  }

  function daysLeft(expiresAt: number) {
    const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 1 ? "1d left" : `${days}d left`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="Email address"
              required
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member" | "viewer")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </form>

        {inviteToken && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invite link
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {`${appUrl}/invite/${inviteToken}`}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium hover:bg-background transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {pending && pending.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pending invitations
            </p>
            <div className="space-y-1">
              {pending.map((inv) => (
                <div
                  key={inv._id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">{inv.invitedEmail}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {inv.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {daysLeft(inv.expiresAt)}
                  </span>
                  <button
                    onClick={() => handleRevoke(inv._id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
