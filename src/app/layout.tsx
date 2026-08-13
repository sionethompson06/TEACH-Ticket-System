import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TEACH Ticket System",
  description:
    "TEACH Ticket System — a service-request platform for TEACH Public Schools. Phase 3 Google Workspace authentication.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
