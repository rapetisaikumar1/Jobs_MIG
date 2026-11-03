import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getStaffContext } from "@/modules/access-control/context";

export default async function ForbiddenPage() {
  const staff = await getStaffContext();
  return (
    <div className="max-w-md rounded-lg border bg-background p-8 text-center">
      <ShieldAlert className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">Access denied</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {staff
          ? "Your role does not include permission for this page. Contact a Super Admin if you need access."
          : "This area is restricted to MaverickInnogarage staff."}
      </p>
      <Link href={staff ? "/admin/jobs" : "/"} className={buttonVariants({ className: "mt-5" })}>
        {staff ? "Back to jobs" : "Go to the job portal"}
      </Link>
    </div>
  );
}
