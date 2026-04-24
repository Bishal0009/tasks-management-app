"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { PersonIcon, TeamIcon } from "../../components/workspace-icons";

type WorkspaceType = "personal" | "team";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const workspaces = useQuery(api.workspaces.listMine);
  const createWorkspace = useMutation(api.workspaces.create);

  const [selected, setSelected] = useState<WorkspaceType | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  // Already onboarded — send to home
  useEffect(() => {
    if (workspaces && workspaces.length > 0) router.replace("/");
  }, [workspaces, router]);

  if (!workspaces || workspaces.length > 0) return null;

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    try {
      const name =
        selected === "personal"
          ? `${user?.firstName ?? "My"}'s Tasks`
          : teamName.trim();
      await createWorkspace({ name, type: selected });
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  const canContinue =
    selected === "personal" || (selected === "team" && teamName.trim().length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome aboard</h1>
          <p className="text-muted-foreground">
            How would you like to use Tasks Management?
          </p>
        </div>

        {/* Cards */}
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
              htmlFor="team-name"
              className="text-sm font-medium leading-none"
            >
              Workspace name
            </label>
            <input
              id="team-name"
              type="text"
              placeholder="e.g. Acme Inc"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canContinue && handleContinue()}
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={!canContinue || loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Setting up…" : "Get started"}
        </button>
      </div>
    </div>
  );
}

