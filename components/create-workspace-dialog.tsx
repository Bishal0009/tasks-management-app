"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useWorkspace } from "../contexts/workspace-context";
import { PersonIcon, TeamIcon } from "./workspace-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type WorkspaceType = "personal" | "team";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: Props) {
  const { user } = useUser();
  const createWorkspace = useMutation(api.workspaces.create);
  const { setActiveWorkspaceId } = useWorkspace();

  const [selected, setSelected] = useState<WorkspaceType | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    selected === "personal" || (selected === "team" && teamName.trim().length > 0);

  async function handleCreate() {
    if (!selected || !canSubmit) return;
    setLoading(true);
    try {
      const name =
        selected === "personal"
          ? `${user?.firstName ?? "My"}'s Tasks`
          : teamName.trim();
      const id = await createWorkspace({ name, type: selected });
      setActiveWorkspaceId(id as Id<"workspaces">);
      onOpenChange(false);
      setSelected(null);
      setTeamName("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Type cards */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelected("personal")}
              className={`rounded-xl border-2 p-6 text-left transition-all focus:outline-none ${
                selected === "personal"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <PersonIcon className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold">Personal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo mode — track tasks just for yourself
              </p>
            </button>

            <button
              onClick={() => setSelected("team")}
              className={`rounded-xl border-2 p-6 text-left transition-all focus:outline-none ${
                selected === "team"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <TeamIcon className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold">Team</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Collaborate with your team on shared projects
              </p>
            </button>
          </div>

          {/* Team name input */}
          {selected === "team" && (
            <div className="space-y-1">
              <label
                htmlFor="new-team-name"
                className="text-sm font-medium leading-none"
              >
                Workspace name
              </label>
              <input
                id="new-team-name"
                type="text"
                placeholder="e.g. Acme Inc"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleCreate()}
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!canSubmit || loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
