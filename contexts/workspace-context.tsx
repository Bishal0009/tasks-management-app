"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type Workspace = {
  _id: Id<"workspaces">;
  name: string;
  type: "personal" | "team";
  createdAt: number;
  role: "owner" | "admin" | "member" | "viewer";
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: Id<"workspaces">) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const STORAGE_KEY = "activeWorkspaceId";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const workspaces = useQuery(api.workspaces.listMine) ?? [];
  const [activeId, setActiveId] = useState<Id<"workspaces"> | null>(null);

  // Resolve active workspace from localStorage, falling back to first workspace
  useEffect(() => {
    if (workspaces.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY) as Id<"workspaces"> | null;
    const isValid = stored && workspaces.some((w) => w._id === stored);
    const resolved = isValid ? stored : workspaces[0]._id;

    setActiveId(resolved);
    localStorage.setItem(STORAGE_KEY, resolved);
  }, [workspaces]);

  function setActiveWorkspaceId(id: Id<"workspaces">) {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeWorkspace = workspaces.find((w) => w._id === activeId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, setActiveWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
