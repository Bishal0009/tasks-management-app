"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Tasks Management
        <UserButton />
      </header>
      <main className="p-8 flex flex-col gap-8">
        <Authenticated>
          <AuthenticatedHome />
        </Authenticated>
        <Unauthenticated>
          <UnauthenticatedRedirect />
        </Unauthenticated>
      </main>
    </>
  );
}

function AuthenticatedHome() {
  const workspaces = useQuery(api.workspaces.listMine);
  const router = useRouter();

  useEffect(() => {
    if (workspaces === undefined) return; // still loading
    if (workspaces.length === 0) router.replace("/onboarding");
  }, [workspaces, router]);

  if (!workspaces || workspaces.length === 0) return null;

  return (
    <div className="max-w-lg mx-auto">
      <p>App content goes here.</p>
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
