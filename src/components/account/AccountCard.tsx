"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { CloudIcon } from "@/components/icons";

const linkButton =
  "mt-3 inline-flex h-8 items-center rounded-lg bg-surface-3 px-3 text-xs font-medium hover:bg-border-strong";

/** Bottom of the sidebar: where the data lives, and what to do about it. */
export function AccountCard({ onNavigate }: { onNavigate?: () => void }) {
  const auth = useAuth();

  if (auth.status === "loading") return <div className="h-[118px]" />;

  if (auth.status === "signed-in") {
    return (
      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-border-strong"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-medium uppercase"
        >
          {auth.user.email.slice(0, 1) || "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm">{auth.user.email}</span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <CloudIcon width={12} height={12} /> Synced to your account
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">Saved in this browser</p>
      {auth.status === "signed-out" ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Sign in to keep your numbers safe and see them on any device.
          </p>
          <Link href="/login" onClick={onNavigate} className={linkButton}>
            Sign in →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Clearing site data erases your numbers. Keep a backup.
          </p>
          <Link href="/settings" onClick={onNavigate} className={linkButton}>
            Back up data →
          </Link>
        </>
      )}
    </div>
  );
}
