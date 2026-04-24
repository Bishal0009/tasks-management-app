"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useWorkspace } from "../contexts/workspace-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type Role = "owner" | "admin" | "member" | "viewer";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageMembersSheet({ open, onOpenChange }: Props) {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Members</SheetTitle>
          <SheetDescription>
            {activeWorkspace.name} · {ROLE_LABELS[activeWorkspace.role as Role]}
          </SheetDescription>
        </SheetHeader>
        <MembersContent workspaceId={activeWorkspace._id} callerRole={activeWorkspace.role as Role} workspaceType={activeWorkspace.type} />
      </SheetContent>
    </Sheet>
  );
}

function MembersContent({
  workspaceId,
  callerRole,
  workspaceType,
}: {
  workspaceId: Id<"workspaces">;
  callerRole: Role;
  workspaceType: "personal" | "team";
}) {
  const members = useQuery(api.members.list, { workspaceId });
  const updateRole = useMutation(api.members.updateRole);
  const removeMember = useMutation(api.members.remove);
  const inviteMember = useMutation(api.members.invite);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<Id<"users"> | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState<string>("");

  const ownerCount = members?.filter(m => m.role === "owner").length ?? 0;

  const canManage = callerRole === "owner" || callerRole === "admin";

  function canChangeRole(targetRole: Role): boolean {
    if (callerRole === "owner") return true;
    if (callerRole === "admin") return targetRole === "member" || targetRole === "viewer";
    return false;
  }

  function canRemove(targetRole: Role): boolean {
    if (callerRole === "owner") return true;
    if (callerRole === "admin") return targetRole === "member" || targetRole === "viewer";
    return false;
  }

  function availableRoles(_targetRole: Role): Role[] {
    if (callerRole === "owner") return ["owner", "admin", "member", "viewer"];
    return ["member", "viewer"];
  }

  async function handleRoleChange(targetUserId: Id<"users">, newRole: Role) {
    try {
      await updateRole({ workspaceId, targetUserId, newRole });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update role");
    }
  }

  async function handleRemove(targetUserId: Id<"users">) {
    try {
      await removeMember({ workspaceId, targetUserId });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove member");
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await inviteMember({ workspaceId, email: inviteEmail.trim().toLowerCase(), role: inviteRole });
      setInviteEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to invite member");
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {members == null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members found.</p>
        ) : (
          members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3">
              <Avatar size="sm">
                {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name} />}
                <AvatarFallback>
                  {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>

              {canChangeRole(m.role as Role) ? (
                <Select
                  value={m.role}
                  onValueChange={(val) => handleRoleChange(m.userId as Id<"users">, val as Role)}
                >
                  <SelectTrigger size="sm" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles(m.role as Role).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground w-28 text-right">
                  {ROLE_LABELS[m.role as Role]}
                </span>
              )}

              {canRemove(m.role as Role) && !(m.role === "owner" && ownerCount === 1) && (
                <button
                  onClick={() => { setPendingDeleteId(m.userId as Id<"users">); setPendingDeleteName(m.name ?? m.email); }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  aria-label="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(o) => !o && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{pendingDeleteName}</strong> from this workspace? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleRemove(pendingDeleteId!); setPendingDeleteId(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite section — team workspaces, owner/admin only */}
      {workspaceType === "team" && canManage && (
        <div className="border-t px-6 py-4 space-y-3">
          <p className="text-sm font-medium">Invite by email</p>

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
            >
              <SelectTrigger size="sm" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {callerRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || inviteLoading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inviteLoading ? "Inviting…" : "Invite"}
          </button>
        </div>
      )}
    </div>
  );
}
