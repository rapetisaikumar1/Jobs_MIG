import * as React from "react";
import { BellRing, FileCheck2, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BENEFITS = [
  { icon: Search, title: "Hand-picked IT roles", text: "Software, data, cloud and infrastructure jobs across the US and Canada." },
  { icon: FileCheck2, title: "Apply in one step", text: "Save your profile and resume once, then apply to any role in minutes." },
  { icon: BellRing, title: "Always know where you stand", text: "Track the status of every application from your dashboard." },
  { icon: ShieldCheck, title: "Private by default", text: "Your resume is shared only for the roles you apply to." },
];

/** Candidate-facing benefits panel shown beside sign-in and registration forms. */
function CandidateAside() {
  return (
    <div className="hidden flex-col justify-center lg:flex">
      <p className="text-sm font-medium text-muted-foreground">For job seekers</p>
      <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">Your next tech role starts here.</h2>
      <ul className="mt-8 space-y-6">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background shadow-xs"><Icon className="size-5" aria-hidden /></span>
            <span>
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  withBenefits = false,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Show the candidate benefits panel beside the form (candidate sign-in and sign-up). */
  withBenefits?: boolean;
}) {
  const card = (
    <div className="w-full max-w-md">
      <Card className="shadow-md">
        <CardHeader className="p-7 pb-4">
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="p-7 pt-0">{children}</CardContent>
      </Card>
      {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );

  if (!withBenefits) return <div className="mx-auto flex w-full justify-center px-4 py-12">{card}</div>;

  return (
    <div className="border-b bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 lg:grid-cols-2 lg:py-16">
        <CandidateAside />
        <div className="flex justify-center lg:justify-end">{card}</div>
      </div>
    </div>
  );
}
