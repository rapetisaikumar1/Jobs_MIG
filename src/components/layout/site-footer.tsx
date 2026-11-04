import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { getAuthUser } from "@/modules/auth/session";

export async function SiteFooter() {
  const signedIn = !!(await getAuthUser().catch(() => null));
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
        <div>
          <Image src={siteConfig.logo.src} alt={siteConfig.name} width={108} height={48} />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
        </div>
        <div className="text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job seekers</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/jobs" className="hover:underline">Browse jobs</Link></li>
            {!signedIn && <li><Link href="/register" className="hover:underline">Create an account</Link></li>}
            <li><Link href="/candidate/dashboard" className="hover:underline">Track applications</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link href="/privacy" className="hover:underline">Privacy policy</Link></li>
            <li><Link href="/admin/login" className="hover:underline">Staff sign-in</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h2>
          <ul className="mt-4 space-y-2.5">
            <li className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" aria-hidden /><a href={`mailto:${siteConfig.contact.email}`} className="hover:underline">{siteConfig.contact.email}</a></li>
            <li className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" aria-hidden /><a href={`tel:${siteConfig.contact.phone.replace(/[^+\d]/g, "")}`} className="hover:underline">{siteConfig.contact.phone}</a></li>
            <li className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" aria-hidden />{siteConfig.contact.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p className="flex items-center gap-1.5"><span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden />IT recruitment across the United States and Canada</p>
        </div>
      </div>
    </footer>
  );
}
