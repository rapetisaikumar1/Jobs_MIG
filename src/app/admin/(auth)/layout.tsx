import { Logo } from "@/components/shared/logo";

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-4 py-10">
      <Logo height={56} className="mb-2" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Staff portal</p>
      {children}
    </div>
  );
}
