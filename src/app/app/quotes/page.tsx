import { redirect } from "next/navigation";
import { appRoutes } from "@/components/app/routes";

// The demo workspace has one quote; send the list route straight to it.
export default function QuotesPage() {
  redirect(appRoutes.quote);
}
