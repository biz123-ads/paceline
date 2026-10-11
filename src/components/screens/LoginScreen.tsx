"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/browser";
import { Button, ButtonLink, Card, Field, TextInput } from "@/components/ui";

const ERRORS: Record<string, string> = {
  expired: "That link has expired or was already used. Ask for a new one.",
  browser: "Open the link in the same browser you asked for it from, or ask for a new one.",
  disabled: "Accounts are not set up on this server.",
};

export function LoginScreen() {
  const auth = useAuth();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => ERRORS[params.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()!.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/projects` },
    });
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? "Too many emails. Wait a minute and try again." : error.message);
      return;
    }
    setSentTo(address);
  }

  let body;
  if (auth.status === "disabled") {
    body = (
      <>
        <p className="text-sm text-muted">
          Accounts are not set up on this copy of the app, so everything stays in this
          browser. Keep a backup from Settings.
        </p>
        <ButtonLink href="/projects" className="mt-5">
          Back to projects
        </ButtonLink>
      </>
    );
  } else if (auth.status === "signed-in") {
    body = (
      <>
        <p className="text-sm text-muted">
          You&apos;re signed in as <span className="text-foreground">{auth.user.email}</span>.
        </p>
        <ButtonLink href="/projects" variant="primary" className="mt-5">
          Go to your projects
        </ButtonLink>
      </>
    );
  } else if (sentTo) {
    body = (
      <>
        <p className="text-sm text-muted">
          We sent a sign-in link to <span className="text-foreground">{sentTo}</span>. Open it
          on this device to continue. It may take a minute; check spam too.
        </p>
        <Button variant="ghost" className="mt-5" onClick={() => setSentTo(null)}>
          Use another email
        </Button>
      </>
    );
  } else {
    body = (
      <form onSubmit={send} noValidate className="space-y-4">
        <Field label="Email" error={error}>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!error}
            autoFocus
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={busy || auth.status === "loading"}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </Button>
        <p className="text-xs text-faint">
          No password. New here? The same link creates your account, with free credits for
          the assistant.
        </p>
      </form>
    );
  }

  return (
    <Card className="mx-auto mt-6 w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        Your projects on every device, backed up, plus the AI assistant.
      </p>
      {body}
    </Card>
  );
}
