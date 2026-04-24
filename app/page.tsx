"use client";

import { useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Users } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "../contexts/workspace-context";
import { WorkspaceSwitcher } from "../components/workspace-switcher";
import { ManageMembersSheet } from "../components/manage-members-sheet";

export default function Home() {
  return (
    <>
      <Authenticated>
        <WorkspaceProvider>
          <AppShell />
        </WorkspaceProvider>
      </Authenticated>
      <Unauthenticated>
        <UnauthenticatedRedirect />
      </Unauthenticated>
    </>
  );
}

function AppShell() {
  const [membersOpen, setMembersOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();

  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <WorkspaceSwitcher />
        <div className="flex items-center gap-2">
          {activeWorkspace && (
            <button
              onClick={() => setMembersOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Manage members"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Members</span>
            </button>
          )}
          <UserButton />
        </div>
      </header>
      <main className="p-8 flex flex-col gap-8">
        <AuthenticatedHome />
      </main>
      <ManageMembersSheet open={membersOpen} onOpenChange={setMembersOpen} />
    </>
  );
}

function AuthenticatedHome() {
  const workspaces = useQuery(api.workspaces.listMine);
  const router = useRouter();

  useEffect(() => {
    if (workspaces === undefined) return;
    if (workspaces.length === 0) router.replace("/onboarding");
  }, [workspaces, router]);

  if (!workspaces || workspaces.length === 0) return null;

  return <WorkspaceContent />;
}

function WorkspaceContent() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  return (
    <div className="max-w-lg mx-auto space-y-2">
      <h2 className="text-xl font-semibold">{activeWorkspace.name}</h2>
      <p className="text-sm text-muted-foreground capitalize">{activeWorkspace.type} workspace</p>
      <p className="text-muted-foreground pt-4">App content goes here.</p>
    </div>
  );
}

function UnauthenticatedRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return null;
}
