import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import { QueryProvider } from "@/components/layout/QueryProvider";

export const metadata: Metadata = {
  title: "Bloom — Enrichment Tracker",
  description: "Track enrichment activities, attendance, and expenses for your growing seedlings",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bloom",
  },
};

export const viewport: Viewport = {
  themeColor: "#16A34A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <QueryProvider>
          <ServiceWorkerRegister />
          <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 flex flex-col min-h-full overflow-x-hidden bg-[var(--bg-primary)]">
              <div className="flex-1 pb-20 md:pb-0">
                {children}
              </div>
            </main>
          </div>
          <BottomNav />
        </QueryProvider>
      </body>
    </html>
  );
}
