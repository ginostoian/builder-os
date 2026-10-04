import { CalendarDays, ClipboardList, FileText, FolderKanban, ArrowRight, Package, UserPlus, Users } from "lucide-react";
import type { QuickActionIcon } from "./quick-actions";

export const QUICK_ICONS: Record<QuickActionIcon, React.ComponentType<{ className?: string }>> = {
  quote: FileText,
  lead: ClipboardList,
  client: Users,
  project: FolderKanban,
  order: Package,
  person: UserPlus,
  calendar: CalendarDays,
  page: ArrowRight,
};
