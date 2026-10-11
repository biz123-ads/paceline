"use client";

import { useEffect, useState } from "react";
import type { ServiceStatus } from "@/server/status";

const OFF: ServiceStatus = { accounts: false, assistant: false, creditSales: false };
let request: Promise<ServiceStatus> | undefined;

/** What the server can do; everything off until it answers (or if it fails). */
export function useServices(): ServiceStatus {
  const [status, setStatus] = useState<ServiceStatus>(OFF);
  useEffect(() => {
    let cancelled = false;
    request ??= fetch("/api/status")
      .then((r) => (r.ok ? (r.json() as Promise<ServiceStatus>) : OFF))
      .catch(() => OFF);
    request.then((s) => !cancelled && setStatus(s));
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}
