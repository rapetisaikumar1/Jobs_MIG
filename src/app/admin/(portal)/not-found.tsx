import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Not-found inside the admin portal: keeps the sidebar and header, and links back to the portal. */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">This record doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/admin/jobs" className={buttonVariants({ variant: "outline" })}>Back to jobs</Link>
    </div>
  );
}
