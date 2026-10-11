"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ZodError } from "zod";
import { Button, ButtonLink, Card, CardHeader, PageTitle, Segmented } from "@/components/ui";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import {
  applyThemePreference,
  readThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";
import { getStorage } from "@/storage";
import { signOut, useAuth } from "@/lib/auth";
import { LocalDataClaim } from "@/components/account/LocalDataClaim";
import { CreditsCard } from "@/components/account/CreditsCard";

function AccountSection() {
  const auth = useAuth();
  if (auth.status === "disabled" || auth.status === "loading") return null;
  if (auth.status === "signed-out") {
    return (
      <Card>
        <CardHeader
          title="Account"
          hint="Sign in to keep your projects in the cloud, on every device, and to use the AI assistant."
        />
        <ButtonLink href="/login" variant="primary">
          Sign in
        </ButtonLink>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardHeader
          title="Account"
          hint={
            <>
              Signed in as <span className="text-foreground">{auth.user.email}</span>. Your projects are
              saved in your account.
            </>
          }
        />
        <LocalDataClaim />
        <Button onClick={() => void signOut()}>Sign out</Button>
      </Card>
      <CreditsCard />
    </>
  );
}

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const satisfies readonly { value: ThemePreference; label: string }[];

function AppearanceCard() {
  // The server has no preference to read, so it renders the default.
  const theme = useSyncExternalStore<ThemePreference>(
    subscribeToTheme,
    readThemePreference,
    () => "dark",
  );
  return (
    <Card>
      <CardHeader title="Appearance" hint="Saved in this browser." />
      <Segmented
        label="Theme"
        options={THEME_OPTIONS}
        value={theme}
        onChange={applyThemePreference}
      />
    </Card>
  );
}

type Status = { tone: "ok" | "error"; text: string } | null;

export function SettingsScreen() {
  const [status, setStatus] = useState<Status>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function exportData() {
    const bundle = await getStorage().exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projectpulse-backup-${bundle.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({
      tone: "ok",
      text: `Exported ${bundle.projects.length} ${bundle.projects.length === 1 ? "project" : "projects"} and ${bundle.snapshots.length} months.`,
    });
  }

  async function importData(file: File) {
    try {
      const raw: unknown = JSON.parse(await file.text());
      await getStorage().importAll(raw);
      setStatus({ tone: "ok", text: `Imported ${file.name}. Existing data with the same ids was updated.` });
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof SyntaxError || error instanceof ZodError
            ? "That file is not a backup from this app."
            : `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <PageTitle title="Settings" />
      <div className="max-w-3xl space-y-4">
        <AccountSection />
        <AppearanceCard />
        <Card>
          <CardHeader
            title="Backup and restore"
            hint="A copy of all your projects as a file. Without an account your data lives only in this browser: clearing site data, a private window or another device won't have it, so export now and then."
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={exportData}>
              <DownloadIcon /> Export JSON
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <UploadIcon /> Import JSON
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Backup file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importData(file);
              }}
            />
          </div>
          {status && (
            <p className={`mt-4 text-sm ${status.tone === "ok" ? "text-foreground" : "text-danger"}`}>
              {status.text}
            </p>
          )}
          <p className="mt-4 text-xs text-faint">
            Importing merges: it adds and updates, it never deletes.
          </p>
        </Card>
      </div>
    </>
  );
}
