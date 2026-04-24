"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { useWorkspace } from "../contexts/workspace-context";
import { PersonIcon, TeamIcon } from "./workspace-icons";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { InviteMembersDialog } from "./invite-members-dialog";
import { Id } from "../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!activeWorkspace) return null;

  const canInvite =
    activeWorkspace.type === "team" &&
    (activeWorkspace.role === "owner" || activeWorkspace.role === "admin");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors focus:outline-none">
          <WorkspaceIcon type={activeWorkspace.type} />
          <span className="max-w-[160px] truncate">{activeWorkspace.name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {activeWorkspace.type === "personal" ? "Personal" : "Team"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws._id}
              onClick={() => setActiveWorkspaceId(ws._id as Id<"workspaces">)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <WorkspaceIcon type={ws.type} />
              <span className="flex-1 truncate">{ws.name}</span>
              <span className="text-xs text-muted-foreground">
                {ws.type === "personal" ? "Personal" : "Team"}
              </span>
              {ws._id === activeWorkspace._id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {canInvite && (
            <DropdownMenuItem
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Users className="h-4 w-4" />
              <span>Invite members</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {canInvite && (
        <InviteMembersDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={activeWorkspace._id as Id<"workspaces">}
        />
      )}
    </>
  );
}

function WorkspaceIcon({ type }: { type: "personal" | "team" }) {
  const Icon = type === "personal" ? PersonIcon : TeamIcon;
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
      <Icon className="h-3 w-3 text-primary" />
    </span>
  );
}
