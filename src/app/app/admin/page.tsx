import { redirect } from "next/navigation";

/** The admin area moved out of the company app. */
export default function OldAdminPage() {
  redirect("/admin");
}
