import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Full MaverickInnogarage logo (mark + wordmark) from /public/brand. */
export function Logo({ href = "/", className, height = 40 }: { href?: string; className?: string; height?: number }) {
  const width = Math.round((siteConfig.logo.width / siteConfig.logo.height) * height);
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center", className)} aria-label={`${siteConfig.name} home`}>
      <Image src={siteConfig.logo.src} alt={siteConfig.name} width={width} height={height} priority />
    </Link>
  );
}
