"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

/** Accepts the invite and opens the board. */
export function JoinBoardButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { boardId } = await api<{ boardId: string }>(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      router.push(`/b/${boardId}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : "Couldn't join the board. Try again.");
    }
  }

  return (
    <>
      <FieldError>{error}</FieldError>
      <Button variant="primary" className="h-10" onClick={join} disabled={busy}>
        {busy ? "Joining…" : "Join board"}
      </Button>
    </>
  );
}

/** Signs out and reloads the invite page, so the right account can sign in. */
export function SwitchAccountButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      className="h-10"
      onClick={async () => {
        await authClient.signOut();
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
