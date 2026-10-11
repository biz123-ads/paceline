import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { APP_DESCRIPTION, APP_NAME } from "@/config/app";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      // The inline theme script may change data-theme before React hydrates.
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        {/*
          A plain inline script runs while the HTML is parsed, before the body
          paints, so the saved theme never flashes. (next/script's
          beforeInteractive queues inline code and runs it later.)
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
