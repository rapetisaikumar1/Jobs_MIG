import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { cleanList } from "@/lib/format";
import { param, paramList, type SearchParams } from "@/lib/pagination";
import type { PublicJobFilters } from "@/modules/jobs/queries";

export function parsePublicJobFilters(params: SearchParams): PublicJobFilters {
  const country = param(params, "country");
  const wa = param(params, "workArrangement");
  const et = param(params, "employmentType");
  return {
    q: param(params, "q")?.slice(0, 100),
    location: param(params, "location")?.slice(0, 100),
    country: country === "US" || country === "CA" ? country : undefined,
    workArrangement: wa && wa in WORK_ARRANGEMENT_LABELS ? (wa as PublicJobFilters["workArrangement"]) : undefined,
    employmentType: et && et in EMPLOYMENT_TYPE_LABELS ? (et as PublicJobFilters["employmentType"]) : undefined,
    skills: cleanList(paramList(params, "skills")).slice(0, 10),
  };
}
