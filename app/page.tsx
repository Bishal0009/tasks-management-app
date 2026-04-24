"use client";

import { Authenticated, Unauthenticated } from "convex/react";
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
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return null;
}
