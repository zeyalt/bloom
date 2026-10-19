import {
  Home,
  History,
  NotebookPen,
  BarChart3,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
