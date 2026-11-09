import {
  Home,
  History,
  NotebookPen,
  BarChart3,
  Settings,
  Target,
} from "lucide-react";

// `bottomNav: false` keeps an item in the desktop sidebar only; on phones Settings
// is reached from the gear in the page header so the bottom bar stays at five.
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home, bottomNav: true },
  { href: "/goals", label: "Goals", icon: Target, bottomNav: true },
  { href: "/history", label: "History", icon: History, bottomNav: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3, bottomNav: true },
  { href: "/journal", label: "Journal", icon: NotebookPen, bottomNav: true },
  { href: "/settings", label: "Settings", icon: Settings, bottomNav: false },
] as const;
