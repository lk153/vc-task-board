"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { LIMITS } from "@/config/board";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { GoogleIcon } from "@/components/ui/google-icon";
import { authClient, authErrorMessage, safeNext } from "@/lib/auth-client";

/** Where to go after signing in (`?next=`), read at submit time. */
const nextPath = () => safeNext(new URLSearchParams(window.location.search).get("next"));

const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "An account with this email already exists. Sign in with your password, then connect Google from your account menu.",
};

function OAuthErrorNotice() {
  const code = useSearchParams().get("error");
  if (!code) return null;
  return (
    <p
      role="alert"
      className="m-0 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] leading-normal text-danger"
    >
      {OAUTH_ERRORS[code] ?? "Google sign-in didn’t work. Please try again."}
    </p>
  );
}

/** Link to the other auth page that keeps `?next=`. */
function SwitchLink({ href, children }: { href: string; children: ReactNode }) {
  const next = useSearchParams().get("next");
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className="font-medium">
      {children}
    </Link>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      className="h-10 w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const next = nextPath();
        await authClient.signIn.social({
          provider: "google",
          callbackURL: next,
          errorCallbackURL: `/sign-in?next=${encodeURIComponent(next)}`,
        });
      }}
    >
      <GoogleIcon size={16} />
      Continue with Google
    </Button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function useAuthSubmit(
  run: () => Promise<{ error: { status?: number; code?: string; message?: string } | null }>,
) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(null);
    const result = await run();
    if (result.error) {
      setBusy(false);
      setError(authErrorMessage(result.error));
      return;
    }
    // Full page load: the client router may hold prefetches made while signed out.
    window.location.assign(nextPath());
  }
  return { error, setError, busy, submit };
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useAuthSubmit(() =>
    authClient.signIn.email({ email: email.trim(), password }),
  );

  return (
    <>
      <Suspense>
        <OAuthErrorNotice />
      </Suspense>
      {googleEnabled && (
        <>
          <GoogleButton />
          <Divider />
        </>
      )}
      <form
        noValidate
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <FieldError>{error}</FieldError>
        <Button variant="primary" type="submit" className="h-10" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="m-0 text-[13px] text-muted">
        New here?{" "}
        <Suspense
          fallback={
            <Link href="/sign-up" className="font-medium">
              Create an account
            </Link>
          }
        >
          <SwitchLink href="/sign-up">Create an account</SwitchLink>
        </Suspense>
      </p>
      <p className="m-0 text-xs leading-normal text-muted">
        Forgot your password? Sign in with Google if you connected it, or ask your admin to reset
        it.
      </p>
    </>
  );
}

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, setError, busy, submit } = useAuthSubmit(() =>
    authClient.signUp.email({ name: name.trim(), email: email.trim(), password }),
  );

  function validate() {
    if (!name.trim()) return "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 8) return "Use at least 8 characters for your password.";
    return null;
  }

  return (
    <>
      {googleEnabled && (
        <>
          <GoogleButton />
          <Divider />
        </>
      )}
      <form
        noValidate
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          const problem = validate();
          if (problem) return setError(problem);
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="name"
            required
            maxLength={LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span id="password-hint" className="text-xs text-muted">
            At least 8 characters.
          </span>
        </Field>
        <FieldError>{error}</FieldError>
        <Button variant="primary" type="submit" className="h-10" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="m-0 text-[13px] text-muted">
        Already have an account?{" "}
        <Suspense
          fallback={
            <Link href="/sign-in" className="font-medium">
              Sign in
            </Link>
          }
        >
          <SwitchLink href="/sign-in">Sign in</SwitchLink>
        </Suspense>
      </p>
    </>
  );
}
