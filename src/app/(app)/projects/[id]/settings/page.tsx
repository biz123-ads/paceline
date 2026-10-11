import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectSettingsScreen } from "@/components/screens/ProjectSettingsScreen";

export const metadata: Metadata = { title: "Project settings" };

export default function ProjectSettingsPage() {
  return (
    <Suspense>
      <ProjectSettingsScreen />
    </Suspense>
  );
}
