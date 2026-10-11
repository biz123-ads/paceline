"use client";

import { useRouter } from "next/navigation";
import type { ProjectData } from "@/components/data/hooks";
import { ProjectForm } from "@/components/project/ProjectForm";
import { ProjectGate } from "@/components/project/ProjectGate";
import { Button, Card, CardHeader } from "@/components/ui";
import { getStorage } from "@/storage";

function ProjectSettings({ data }: { data: ProjectData }) {
  const router = useRouter();
  const { project, snapshots } = data;

  async function remove() {
    const months = snapshots.length;
    const ok = window.confirm(
      `Delete “${project.name}” with its ${months} ${months === 1 ? "month" : "months"} of numbers and its goal? This cannot be undone.`,
    );
    if (!ok) return;
    await getStorage().projects.remove(project.id);
    router.push("/projects");
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <ProjectForm
          project={project}
          submitLabel="Save changes"
          onSave={(next) => getStorage().projects.save(next)}
        />
      </Card>
      <Card className="border-danger/25">
        <CardHeader
          title="Delete project"
          hint="Removes the project, every month you entered and its goal."
        />
        <Button variant="danger" onClick={remove}>
          Delete project
        </Button>
      </Card>
    </div>
  );
}

export function ProjectSettingsScreen() {
  return <ProjectGate>{(data) => <ProjectSettings data={data} />}</ProjectGate>;
}
