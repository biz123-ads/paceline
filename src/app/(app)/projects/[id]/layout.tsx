import { Suspense } from "react";
import { AddMonthProvider } from "@/components/project/AddMonth";
import { ProjectHeader } from "@/components/project/ProjectHeader";

/**
 * cacheComponents is on, so anything that reads the dynamic [id] segment
 * (params, usePathname) must sit inside a Suspense boundary. Project data
 * lives in the browser, so pages read the id on the client as well.
 */
export default function ProjectLayout({
  children,
}: LayoutProps<"/projects/[id]">) {
  return (
    <Suspense fallback={<div className="mb-6 h-[118px]" />}>
      <AddMonthProvider>
        <ProjectHeader />
        {children}
      </AddMonthProvider>
    </Suspense>
  );
}
