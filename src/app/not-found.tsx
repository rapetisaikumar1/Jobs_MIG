import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo height={48} />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/jobs" className={buttonVariants()}>Browse jobs</Link>
    </div>
  );
}
