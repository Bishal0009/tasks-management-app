"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import Link from "next/link";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = useQuery(api.invitations.getByToken, { token });
  const acceptInvitation = useMutation(api.invitations.acceptInvitation);

  if (!isLoaded || invite === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!invite) {
    return (
      <StatusCard
        title="Invalid invite link"
        description="This invite link doesn't exist or has been removed."
      />
    );
  }

  const isExpired = invite.expiresAt < Date.now();

  if (invite.status === "accepted") {
    return (
      <StatusCard
        title="Already accepted"
        description="This invitation has already been accepted."
      />
    );
  }

  if (invite.status === "revoked" || isExpired) {
    return (
      <StatusCard
        title="Invite unavailable"
        description="This invitation has expired or been revoked."
      />
    );
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const result = await acceptInvitation({ token });
      localStorage.setItem("activeWorkspaceId", result.workspaceId);
      router.replace("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("already_member")) {
        setError("You're already a member of this workspace.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setAccepting(false);
    }
  }

  const encodedRedirect = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">You've been invited</h1>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{invite.inviterName}</span>{" "}
            invited you to join{" "}
            <span className="font-medium text-foreground">{invite.workspaceName}</span>{" "}
            as a <span className="capitalize">{invite.role}</span>.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isSignedIn ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {accepting ? "Joining…" : `Join ${invite.workspaceName}`}
          </button>
        ) : (
          <div className="space-y-3">
            <Link
              href={`/sign-up?redirect_url=${encodedRedirect}`}
              className="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create account to join
            </Link>
            <Link
              href={`/sign-in?redirect_url=${encodedRedirect}`}
              className="block w-full rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
            >
              Sign in to join
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Expires {new Date(invite.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <Link
          href="/"
          className="inline-block rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Go to app
        </Link>
      </div>
    </div>
  );
}
