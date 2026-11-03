import { redirect } from "next/navigation";

/** Old URL; case files live under /admin/case-files. */
export default async function LegacyCaseFileRedirect({ params }: { params: Promise<{ jobId: string }> }) {
  redirect(`/admin/case-files/${(await params).jobId}`);
}
