import { Suspense } from "react";
import { OverviewScreen } from "@/components/screens/OverviewScreen";

export default function ProjectOverviewPage() {
  return (
    <Suspense>
      <OverviewScreen />
    </Suspense>
  );
}
