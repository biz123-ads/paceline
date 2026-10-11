import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/screens/PlanScreen";

export const metadata: Metadata = { title: "Plan" };

export default function ProjectPlanPage() {
  return (
    <Suspense>
      <PlanScreen />
    </Suspense>
  );
}
