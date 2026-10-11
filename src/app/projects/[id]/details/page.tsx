import type { Metadata } from "next";
import { Suspense } from "react";
import { DetailsScreen } from "@/components/screens/DetailsScreen";

export const metadata: Metadata = { title: "Details" };

export default function ProjectDetailsPage() {
  return (
    <Suspense>
      <DetailsScreen />
    </Suspense>
  );
}
