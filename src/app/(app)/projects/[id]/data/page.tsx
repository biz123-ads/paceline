import type { Metadata } from "next";
import { Suspense } from "react";
import { DataScreen } from "@/components/screens/DataScreen";

export const metadata: Metadata = { title: "Data" };

export default function ProjectDataPage() {
  return (
    <Suspense>
      <DataScreen />
    </Suspense>
  );
}
