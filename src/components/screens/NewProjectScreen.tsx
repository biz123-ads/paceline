"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/project/ProjectForm";
import { Card, PageTitle } from "@/components/ui";
import { getStorage } from "@/storage";

export function NewProjectScreen() {
  const router = useRouter();
  return (
    <>
      <PageTitle
        title="New project"
        subtitle="Start with a name. You can fill in the rest later."
      />
      <Card className="max-w-3xl">
        <ProjectForm
          submitLabel="Create project"
          onSave={async (project) => {
            await getStorage().projects.save(project);
            // Straight to the first month: that is what makes the project useful.
            router.push(`/projects/${project.id}/data#add`);
          }}
        />
      </Card>
    </>
  );
}
