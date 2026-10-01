import { redirect } from "next/navigation";
import { appRoutes } from "@/components/app/routes";

export default function ProjectsPage() {
  redirect(appRoutes.project);
}
