import {
  Home,
  History,
  NotebookPen,
  BarChart3,
  Target,
} from "lucide-react";

// The five tabs. Settings isn't one: it opens as a dialog, from the sidebar's
// foot on desktop and the gear in the page header on phones.
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: NotebookPen },
] as const;
