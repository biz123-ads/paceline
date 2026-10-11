"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { CloseIcon } from "@/components/icons";

/**
 * A modal on the native <dialog>: focus trap, Escape and the top layer come
 * from the browser. `side` slides it in from the right (the assistant).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  side = false,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cx(
        "border border-border-strong bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60",
        side
          ? "my-0 mr-0 ml-auto h-dvh max-h-dvh w-full max-w-md rounded-none border-y-0 border-r-0"
          : "m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl",
        className,
      )}
    >
      {open && (
        <div className={cx("flex flex-col", side && "h-full")}>
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-medium tracking-tight">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>
          <div className={cx("px-5 pt-4 pb-5", side && "flex min-h-0 flex-1 flex-col")}>
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * A small "?" that explains a term on hover, focus or tap. Hidden with
 * display:none, so it never widens the page while closed.
 */
export function Hint({
  children,
  term,
  align = "left",
}: {
  children: ReactNode;
  /** What is being explained, for screen readers: "What is churn?" */
  term: string;
  align?: "left" | "right";
}) {
  const id = useId();
  return (
    <span className="group relative ml-1 inline-flex align-[-2px]">
      <button
        type="button"
        aria-label={`What is ${term}?`}
        aria-describedby={id}
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-border-strong text-[9px] leading-none font-medium text-muted transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:border-foreground/60 focus-visible:text-foreground focus-visible:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        id={id}
        className={cx(
          "absolute top-full z-30 mt-2 hidden w-64 max-w-[calc(100vw-3rem)] rounded-lg bg-foreground px-3 py-2 text-left text-xs leading-relaxed font-normal tracking-normal text-background normal-case shadow-lg group-focus-within:block group-hover:block",
          align === "left" ? "-left-2" : "-right-2",
        )}
      >
        {children}
      </span>
    </span>
  );
}
