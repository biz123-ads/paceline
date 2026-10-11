"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  PROJECT_KINDS,
  assumptionsSchema,
  projectSchema,
  type Goal,
  type Project,
} from "@/domain";
import { GoalFields, goalFromDraft, type GoalDraft } from "@/components/project/GoalEditor";
import { GLOSSARY } from "@/components/project/glossary";
import { buildSnapshot } from "@/components/project/month-values";
import { CURRENCIES, KIND_LABELS } from "@/components/project/labels";
import { Hint } from "@/components/overlay";
import { Button, Card, Field, Select, TextInput, cx } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { currencySymbol, formatMoney, formatPeriod, parseCount, parseMoney } from "@/lib/format";
import { newId, nowIso } from "@/lib/id";
import { addMonths, currentPeriod } from "@/lib/period";
import { getStorage } from "@/storage";

type Step = 1 | 2 | 3;

/** The month the setup asks about: the last one that is over. */
function lastFullMonth() {
  return addMonths(currentPeriod(), -1);
}

interface Basics {
  name: string;
  currency: string;
  kind: Project["kind"];
}

interface Numbers {
  mrr: number;
  payingCustomers: number;
  /** Asked only when there are no customers yet. */
  price: number | null;
}

function Steps({ step }: { step: Step }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs text-muted">Step {step} of 3</p>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((s) => (
          <span key={s} className={cx("h-1 flex-1 rounded-full", s <= step ? "bg-foreground" : "bg-surface-3")} />
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  title,
  text,
  children,
}: {
  step: Step;
  title: string;
  text: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mx-auto w-full max-w-xl p-6 sm:p-8">
      <Steps step={step} />
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">{text}</p>
      {children}
    </Card>
  );
}

function BasicsStep({ initial, onNext }: { initial: Basics; onNext: (b: Basics) => void }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function next(e: FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Give the project a name.");
      return;
    }
    onNext({ ...values, name: values.name.trim() });
  }

  return (
    <form onSubmit={next} noValidate className="space-y-5">
      <Field label="Name" error={error}>
        <TextInput
          value={values.name}
          onChange={(e) => {
            setValues((v) => ({ ...v, name: e.target.value }));
            setError(null);
          }}
          placeholder="e.g. Invoicely"
          aria-invalid={!!error}
          autoFocus
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={values.kind === k}
              onClick={() => setValues((v) => ({ ...v, kind: k }))}
              className={cx(
                "h-9 rounded-lg border px-4 text-sm transition-colors",
                values.kind === k
                  ? "border-foreground/50 bg-surface-3 text-foreground"
                  : "border-border-strong text-muted hover:text-foreground",
              )}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Currency" hint="Every amount in this project uses it.">
        <Select value={values.currency} onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value }))}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="primary" className="w-full sm:w-auto">
        Next
      </Button>
    </form>
  );
}

function NumbersStep({
  currency,
  initial,
  onBack,
  onNext,
  onSkip,
  onImport,
}: {
  currency: string;
  initial: Numbers | null;
  onBack: () => void;
  onNext: (n: Numbers) => void;
  onSkip: () => void;
  onImport: () => void;
}) {
  const [mrr, setMrr] = useState(initial ? String(initial.mrr / 100) : "");
  const [customers, setCustomers] = useState(initial ? String(initial.payingCustomers) : "");
  const [price, setPrice] = useState(initial?.price ? String(initial.price / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const noCustomers = customers.trim() !== "" && parseCount(customers) === 0;

  function next(e: FormEvent) {
    e.preventDefault();
    const m = parseMoney(mrr);
    const c = parseCount(customers);
    if (m === null || c === null) {
      setError("Enter both numbers. Zero is fine if you haven't started charging.");
      return;
    }
    const p = noCustomers && price.trim() ? parseMoney(price) : null;
    if (noCustomers && price.trim() && !p) {
      setError("Enter the price as a number, like 19.");
      return;
    }
    onNext({ mrr: m, payingCustomers: c, price: p });
  }

  const sym = currencySymbol(currency);
  return (
    <form onSubmit={next} noValidate className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Monthly revenue" tip={<Hint term="monthly revenue">{GLOSSARY.revenue}</Hint>}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
              {sym}
            </span>
            <TextInput
              value={mrr}
              onChange={(e) => {
                setMrr(e.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder="0"
              className="num pl-7"
              autoFocus
            />
          </div>
        </Field>
        <Field label="Paying customers" tip={<Hint term="a paying customer">{GLOSSARY.customers}</Hint>}>
          <TextInput
            value={customers}
            onChange={(e) => {
              setCustomers(e.target.value);
              setError(null);
            }}
            inputMode="numeric"
            placeholder="0"
            className="num"
          />
        </Field>
      </div>
      {noCustomers && (
        <Field label="What will you charge a customer each month?" hint="Optional. The plan needs a price to count customers.">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-faint">
              {sym}
            </span>
            <TextInput
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setError(null);
              }}
              inputMode="decimal"
              placeholder="19"
              className="num pl-7"
            />
          </div>
        </Field>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Back">
          <ArrowLeftIcon />
        </Button>
        <Button type="submit" variant="primary">
          Next
        </Button>
        <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button type="button" onClick={onImport} className="text-muted underline hover:text-foreground">
            Import instead
          </button>
          <button type="button" onClick={onSkip} className="text-muted underline hover:text-foreground">
            Skip for now
          </button>
        </span>
      </div>
    </form>
  );
}

export function NewProjectScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [basics, setBasics] = useState<Basics>({ name: "", currency: "EUR", kind: "saas" });
  const [numbers, setNumbers] = useState<Numbers | null>(null);

  /** Saves everything collected so far and returns the project's id. */
  async function create(goalDraft: GoalDraft | null, numbersToSave: Numbers | null) {
    const lastMonth = lastFullMonth();
    const storage = getStorage();
    const now = nowIso();
    const project = projectSchema.parse({
      id: newId(),
      name: basics.name,
      kind: basics.kind,
      stage: numbersToSave && numbersToSave.mrr > 0 ? "launched" : "building",
      currency: basics.currency,
      createdAt: now,
      updatedAt: now,
    });
    await storage.projects.save(project);
    if (numbersToSave) {
      await storage.snapshots.upsert(
        buildSnapshot(project.id, lastMonth, {
          mrr: numbersToSave.mrr,
          payingCustomers: numbersToSave.payingCustomers,
        }),
      );
      if (numbersToSave.price) {
        await storage.assumptions.save(
          assumptionsSchema.parse({ projectId: project.id, arpu: numbersToSave.price, updatedAt: now }),
        );
      }
      if (goalDraft) {
        const goal: Goal = goalFromDraft(goalDraft, project.id, { period: lastMonth, mrr: numbersToSave.mrr });
        await storage.goals.save(goal);
      }
    }
    return project.id;
  }

  if (step === 1) {
    return (
      <StepCard step={1} title="Name your project" text="You can change all of this later.">
        <BasicsStep
          initial={basics}
          onNext={(b) => {
            setBasics(b);
            setStep(2);
          }}
        />
      </StepCard>
    );
  }

  // Read the clock only past step 1: step 1 is what gets prerendered.
  const lastMonth = lastFullMonth();
  if (step === 2) {
    return (
      <StepCard
        step={2}
        title="Where are you now?"
        text={`Your numbers for ${formatPeriod(lastMonth)}, the last full month. Rough is fine.`}
      >
        <NumbersStep
          currency={basics.currency}
          initial={numbers}
          onBack={() => setStep(1)}
          onNext={(n) => {
            setNumbers(n);
            setStep(3);
          }}
          onSkip={async () => router.push(`/projects/${await create(null, null)}`)}
          onImport={async () => router.push(`/projects/${await create(null, null)}/data#import`)}
        />
      </StepCard>
    );
  }

  const current = numbers!;
  return (
    <StepCard
      step={3}
      title="Where do you want to go?"
      text={`From ${formatMoney(current.mrr, basics.currency)} a month today. Pick a target and a date; we work out what it takes.`}
    >
      <GoalFields
        currency={basics.currency}
        latest={{ period: lastMonth, mrr: current.mrr }}
        submitLabel="Create project"
        onSubmit={async (draft) => router.push(`/projects/${await create(draft, current)}`)}
        secondary={
          <>
            <Button variant="ghost" onClick={() => setStep(2)} aria-label="Back" className="order-first">
              <ArrowLeftIcon />
            </Button>
            <button
              type="button"
              onClick={async () => router.push(`/projects/${await create(null, current)}`)}
              className="ml-auto text-sm text-muted underline hover:text-foreground"
            >
              Skip, no goal yet
            </button>
          </>
        }
      />
    </StepCard>
  );
}
