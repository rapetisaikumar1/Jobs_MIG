"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * On phones the filter panel starts collapsed behind a button so jobs appear first.
 * On large screens it is always shown. The inputs stay in the form either way.
 */
export function MobileFilterToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" className="w-full lg:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal aria-hidden /> {open ? "Hide filters" : "Filters"}
      </Button>
      <div className={open ? "mt-3 block lg:mt-0" : "hidden lg:block"}>{children}</div>
    </>
  );
}
