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
          <div className="max-w-lg mx-auto">
            <p>App content goes here.</p>
          </div>
        </Authenticated>
        <Unauthenticated>
          <UnauthenticatedRedirect />
        </Unauthenticated>
      </main>
    </>
  );
}

function UnauthenticatedRedirect() {
  const hasSuperAdmin = useQuery(api.users.hasSuperAdmin);
  const router = useRouter();

  useEffect(() => {
    if (hasSuperAdmin === undefined) return;
    router.replace(hasSuperAdmin ? "/sign-in" : "/sign-up");
  }, [hasSuperAdmin, router]);

  return null;
}
