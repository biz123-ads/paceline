import { AppShell } from "@/components/layout/AppShell";

/** Everything behind the landing page: sidebar plus the screen. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
