"use client";

import { SignIn } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const hasSuperAdmin = useQuery(api.users.hasSuperAdmin);
  const router = useRouter();

  useEffect(() => {
    if (hasSuperAdmin === undefined) return;
    if (!hasSuperAdmin) router.replace("/sign-up");
  }, [hasSuperAdmin, router]);

  if (hasSuperAdmin === undefined || !hasSuperAdmin) return null;

  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
