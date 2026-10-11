import type { Metadata } from "next";
import { DemoScreen } from "@/components/screens/DemoScreen";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  return <DemoScreen />;
}
