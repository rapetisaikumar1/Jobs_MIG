import { redirect } from "next/navigation";

/** The admin dashboard was removed; staff land on Jobs. Kept so old bookmarks still work. */
export default function DashboardRedirect() {
  redirect("/admin/jobs");
}
