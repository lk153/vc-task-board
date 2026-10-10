"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { useUi } from "@/store/ui-store";

/** Change password while signed in. Other sessions are signed out. */
export function ChangePasswordDialog() {
  const open = useUi((s) => s.dialog === "changePassword");
  const closeDialog = useUi((s) => s.closeDialog);
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      title="Change password"
      size="sm"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="change-password-form">
            Change password
          </Button>
        </>
      }
    >
      {open && <ChangePasswordForm />}
    </Modal>
  );
}

function ChangePasswordForm() {
  const closeDialog = useUi((s) => s.closeDialog);
  const showToast = useUi((s) => s.showToast);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (next.length < 8) return setError("Use at least 8 characters for your new password.");
    setBusy(true);
    const { error: failure } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (failure) return setError(authErrorMessage(failure));
    closeDialog();
    showToast("Password changed");
  }

  return (
    <form
      id="change-password-form"
      noValidate
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="contents"
    >
      <Field>
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoFocus
        />
      </Field>
      <Field>
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          invalid={Boolean(error)}
          aria-describedby="new-password-hint"
        />
        <span id="new-password-hint" className="text-xs text-muted">
          At least 8 characters. You’ll stay signed in here; other devices are signed out.
        </span>
      </Field>
      <FieldError>{error}</FieldError>
    </form>
  );
}
