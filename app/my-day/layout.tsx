import type { Metadata } from "next";

// Its own manifest, so "Add to Home Screen" on the kids' tablet opens straight to My Day.
export const metadata: Metadata = {
  title: "My Day",
  manifest: "/my-day.webmanifest",
  appleWebApp: { capable: true, title: "My Day", statusBarStyle: "default" },
};

export default function MyDayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
