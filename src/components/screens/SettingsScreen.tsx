"use client";

import { useRef, useState } from "react";
import { ZodError } from "zod";
import { Button, Card, CardHeader, PageTitle } from "@/components/ui";
import { DownloadIcon, UploadIcon } from "@/components/icons";
import { getStorage } from "@/storage";

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
        <Card>
          <CardHeader
            title="Backup and restore"
            hint="There are no accounts yet: your data is stored in this browser only. Clearing site data, private windows or another device will not have it. Export a backup now and then."
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
