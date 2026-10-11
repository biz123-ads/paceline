import type { Metadata } from "next";
import { ImportScreen } from "@/components/screens/ImportScreen";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return <ImportScreen />;
}
