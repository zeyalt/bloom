import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/layout/QueryProvider";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { AppShell } from "@/components/layout/AppShell";
import { LaunchSplash, LAUNCH_SPLASH_SCRIPT } from "@/components/layout/LaunchSplash";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// [width, height, pixel ratio] of the iPhones that get a matching launch image.
const LAUNCH_IMAGES: [number, number, number][] = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [390, 844, 3], [428, 926, 3],
  [414, 896, 2], [414, 896, 3], [375, 812, 3], [375, 667, 2], [360, 780, 3],
];

export const metadata: Metadata = {
  title: "Bloom",
  description: "Attendance, expenses, and notes for the kids' classes",
  manifest: "/manifest.json",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bloom",
    // iPhone launch screens: the logo on the paper colour, centred at 160pt tall —
    // the first frame of the in-app launch animation.
    startupImage: LAUNCH_IMAGES.map(([w, h, r]) => ({
      url: `/splash/launch-${w}x${h}@${r}x.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
};

export const viewport: Viewport = {
  themeColor: "#eef2ec",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The launch script adds `splash` to <html> before React hydrates.
    <html lang="en" className={`${bricolage.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SPLASH_SCRIPT }} />
        <link rel="preload" as="image" href="/splash/base.png" />
        <link rel="preload" as="image" href="/splash/sprout.png" />
      </head>
      <body className={`${bricolage.className} h-full overflow-hidden antialiased`}>
        <LaunchSplash />
        <QueryProvider>
          <SnackbarProvider>
            <AppShell>{children}</AppShell>
          </SnackbarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
