"use client";

import { useState, type FormEvent } from "react";
import {
  PROJECT_KINDS,
  PROJECT_STAGES,
  projectSchema,
  type Project,
} from "@/domain";
import { Button, Field, Select, TextArea, TextInput } from "@/components/ui";
import { ChevronDownIcon } from "@/components/icons";
import { newId, nowIso } from "@/lib/id";
import { CURRENCIES, KIND_LABELS, STAGE_LABELS } from "./labels";

interface FormValues {
  name: string;
  description: string;
  kind: Project["kind"];
  stage: Project["stage"];
  currency: string;
  websiteUrl: string;
  launchDate: string;
  pricingSummary: string;
  targetAudience: string;
  techStack: string;
  notes: string;
}

function toValues(project?: Project): FormValues {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    kind: project?.kind ?? "saas",
    stage: project?.stage ?? "launched",
    currency: project?.currency ?? "EUR",
    websiteUrl: project?.websiteUrl ?? "",
    launchDate: project?.launchDate ?? "",
    pricingSummary: project?.pricingSummary ?? "",
    targetAudience: project?.targetAudience ?? "",
    techStack: project?.techStack.join(", ") ?? "",
    notes: project?.notes ?? "",
  };
}

type Errors = Partial<Record<keyof FormValues, string>>;

export function ProjectForm({
  project,
  submitLabel,
  onSave,
}: {
  /** Existing project to edit; omit to create one. */
  project?: Project;
  submitLabel: string;
  onSave: (project: Project) => Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => toValues(project));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  // Open when there is something in it already.
  const [hasDetails] = useState(
    () =>
      !!project &&
      !!(
        project.websiteUrl ||
        project.launchDate ||
        project.pricingSummary ||
        project.targetAudience ||
        project.techStack.length ||
        project.notes
      ),
  );

  const set =
    <K extends keyof FormValues>(key: K) =>
    (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setStatus("idle");
    };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const website = values.websiteUrl.trim();
    const now = nowIso();
    const candidate = {
      id: project?.id ?? newId(),
      userId: project?.userId ?? null,
      name: values.name,
      description: values.description.trim(),
      kind: values.kind,
      stage: values.stage,
      currency: values.currency,
      websiteUrl: website ? (/^https?:\/\//.test(website) ? website : `https://${website}`) : undefined,
      launchDate: values.launchDate || undefined,
      pricingSummary: values.pricingSummary.trim(),
      targetAudience: values.targetAudience.trim(),
      techStack: values.techStack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      // Edited on the project page, next to costs.
      cashBalance: project?.cashBalance ?? 0,
      notes: values.notes.trim(),
      createdAt: project?.createdAt ?? now,
      updatedAt: now,
    };
    const parsed = projectSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        next[key] ??=
          key === "name"
            ? "Give the project a name."
            : key === "websiteUrl"
              ? "Enter a web address like example.com."
              : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStatus("saving");
    await onSave(parsed.data);
    setStatus("saved");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Basics</legend>
        <Field label="Name" error={errors.name} className="sm:col-span-2">
          <TextInput
            value={values.name}
            onChange={set("name")}
            placeholder="e.g. Invoicely"
            aria-invalid={!!errors.name}
            autoFocus={!project}
          />
        </Field>
        <Field label="What it is">
          <Select value={values.kind} onChange={set("kind")}>
            {PROJECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage">
          <Select value={values.stage} onChange={set("stage")}>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Currency"
          hint={project ? "Changing it relabels amounts; it does not convert them." : "Used for every amount in this project."}
          className="sm:col-span-2"
        >
          <Select value={values.currency} onChange={set("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Short description" className="sm:col-span-2">
          <TextArea
            value={values.description}
            onChange={set("description")}
            placeholder="One or two lines: what it does and for whom."
            rows={2}
          />
        </Field>
      </fieldset>

      <details open={hasDetails} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon className="-rotate-90 transition-transform group-open:rotate-0" />
          More about the project <span className="text-faint">· optional</span>
        </summary>
      <fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">More about the project</legend>
        <Field label="Website" error={errors.websiteUrl}>
          <TextInput
            value={values.websiteUrl}
            onChange={set("websiteUrl")}
            placeholder="example.com"
            aria-invalid={!!errors.websiteUrl}
          />
        </Field>
        <Field label="Launch date">
          <TextInput type="date" value={values.launchDate} onChange={set("launchDate")} />
        </Field>
        <Field label="Pricing">
          <TextInput
            value={values.pricingSummary}
            onChange={set("pricingSummary")}
            placeholder="e.g. 9 €/month, 79 €/year"
          />
        </Field>
        <Field label="Target audience">
          <TextInput
            value={values.targetAudience}
            onChange={set("targetAudience")}
            placeholder="e.g. Freelance designers"
          />
        </Field>
        <Field label="Tech stack" hint="Separate with commas." className="sm:col-span-2">
          <TextInput
            value={values.techStack}
            onChange={set("techStack")}
            placeholder="Next.js, Supabase, Stripe"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <TextArea value={values.notes} onChange={set("notes")} rows={3} />
        </Field>
      </fieldset>
      </details>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : submitLabel}
        </Button>
        {status === "saved" && project && <span className="text-sm text-muted">Saved</span>}
      </div>
    </form>
  );
}
