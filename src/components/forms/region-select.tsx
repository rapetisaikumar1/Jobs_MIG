"use client";

import * as React from "react";
import { Input, Select } from "@/components/ui/input";
import { regionsFor } from "@/config/locations";

type Props = { country: string | undefined; invalid?: boolean; allowEmpty?: boolean } & Omit<
  React.ComponentProps<"select">,
  "ref"
> & { ref?: React.Ref<HTMLSelectElement & HTMLInputElement> };

/** State/province picker for US and Canada; free text for other countries. */
export function RegionSelect({ country, invalid, allowEmpty = true, ref, ...props }: Props) {
  const regions = regionsFor(country);
  if (!regions.length) {
    return (
      <Input
        ref={ref}
        aria-invalid={invalid || undefined}
        placeholder="State / Province / Region"
        {...(props as React.ComponentProps<"input">)}
      />
    );
  }
  return (
    <Select ref={ref} aria-invalid={invalid || undefined} {...props}>
      {allowEmpty && <option value="">{country === "CA" ? "Select province" : "Select state"}</option>}
      {regions.map((r) => (
        <option key={r.code} value={r.code}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}
