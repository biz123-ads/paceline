"use client";

import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./ui";

/** The id a Field gives its control, and the id of its hint or error. */
const FieldContext = createContext<{ id: string; describedBy?: string } | null>(null);

/**
 * Label, control, then a hint or an error. The label points at the control
 * by id, so a `tip` (a "?" button) can sit next to the label without
 * becoming what the label names.
 */
export function Field({
  label,
  tip,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  /** Shown after the label, outside it: a <Hint>. */
  tip?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  return (
    <div className={cx("block", className)}>
      <div className="mb-1.5 flex items-center text-xs font-medium text-muted">
        <label htmlFor={id}>{label}</label>
        {tip}
      </div>
      <FieldContext.Provider value={{ id, describedBy: note ? noteId : undefined }}>
        {children}
      </FieldContext.Provider>
      {error ? (
        <span id={noteId} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      ) : (
        hint && (
          <span id={noteId} className="mt-1 block text-xs text-faint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

/** id and aria-describedby from the surrounding Field, unless given. */
function useFieldProps(id?: string, describedBy?: string) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.id,
    "aria-describedby": describedBy ?? field?.describedBy,
  };
}

const inputClass =
  "h-9 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-sm text-foreground placeholder:text-faint outline-none transition-colors focus:border-foreground/40 aria-invalid:border-danger/70";

export function TextInput({
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useFieldProps(id, describedBy)} className={cx(inputClass, className)} {...props} />;
}

export function TextArea({
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...useFieldProps(id, describedBy)}
      className={cx(inputClass, "h-auto min-h-20 py-2", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  id,
  "aria-describedby": describedBy,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...useFieldProps(id, describedBy)} className={cx(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}
