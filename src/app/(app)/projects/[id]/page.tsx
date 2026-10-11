import { Suspense } from "react";
import { ProjectScreen } from "@/components/screens/ProjectScreen";

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectScreen />
    </Suspense>
  );
}
