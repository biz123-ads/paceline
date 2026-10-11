import type { Metadata } from "next";
import { NewProjectScreen } from "@/components/screens/NewProjectScreen";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return <NewProjectScreen />;
}
