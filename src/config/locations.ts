export type Region = { code: string; name: string };

export const US_STATES: Region[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

export const CA_PROVINCES: Region[] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
].map(([code, name]) => ({ code, name }));

export function regionsFor(country: string | null | undefined): Region[] {
  if (country === "US") return US_STATES;
  if (country === "CA") return CA_PROVINCES;
  return [];
}

/** Display name for a state/province code; falls back to the stored value (free text for OTHER). */
export function regionName(country: string | null | undefined, code: string | null | undefined): string {
  if (!code) return "";
  return regionsFor(country).find((r) => r.code === code)?.name ?? code;
}

const COUNTRY_NAMES: Record<string, string> = { US: "United States", CA: "Canada" };

/** "Toronto, Ontario, Canada" */
export function formatLocation(city: string | null | undefined, state: string | null | undefined, country: string | null | undefined): string {
  return [city, regionName(country, state), country ? (COUNTRY_NAMES[country] ?? (country === "OTHER" ? "" : country)) : ""]
    .filter(Boolean)
    .join(", ");
}

/** A job's states / provinces: the "states" list, falling back to the single "state" (rows saved before multi-state). */
export function jobStates(job: { state?: string | null; states?: readonly string[] | null }): string[] {
  if (job.states?.length) return [...job.states];
  return job.state ? [job.state] : [];
}

/**
 * Location of a job that may be open in several states / provinces.
 * One state: "Seattle, Washington, United States" (same as formatLocation).
 * Two or three: "Seattle · WA, OR, CA · United States" (codes keep it short).
 * More: "Seattle · 7 states · United States" (the full list is on the job page).
 */
export function formatJobLocation(city: string | null | undefined, states: readonly string[] | null | undefined, country: string | null | undefined): string {
  const list = (states ?? []).filter(Boolean);
  if (list.length <= 1) return formatLocation(city, list[0], country);
  const countryName = country ? (COUNTRY_NAMES[country] ?? (country === "OTHER" ? "" : country)) : "";
  const regions = list.length > 3 ? `${list.length} ${country === "CA" ? "provinces" : "states"}` : list.join(", ");
  return [city, regions, countryName].filter(Boolean).join(" · ");
}

/** Full names of a job's states / provinces, e.g. "Washington, Oregon". */
export function formatRegionNames(country: string | null | undefined, states: readonly string[] | null | undefined): string {
  return (states ?? []).filter(Boolean).map((s) => regionName(country, s)).join(", ");
}

/**
 * State / province codes a search term refers to: an exact code ("TX", "on") or a name or a word
 * of a name starting with the term ("tex" → TX, "york" → NY). Prefix matching keeps "on" from
 * matching every name that merely contains those letters (Washington, Oregon, ...).
 */
export function matchRegions(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const all = [...US_STATES, ...CA_PROVINCES];
  const exact = all.filter((r) => r.code.toLowerCase() === t);
  if (exact.length) return exact.map((r) => r.code);
  return all
    .filter((r) => {
      const name = r.name.toLowerCase();
      return name.startsWith(t) || name.split(/[\s-]+/).some((word) => word.startsWith(t));
    })
    .map((r) => r.code);
}

/**
 * Splits a typed location into a city part and the regions it names: "Austin, TX" → city "Austin",
 * regions [TX]; "Texas" → regions [TX] (or a city called Texas); "Toronto" → city only.
 */
export function parseLocationQuery(location: string): { city: string | null; regions: string[]; regionOnly: boolean } {
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { city: null, regions: [], regionOnly: false };
  if (parts.length === 1) {
    // A bare state / province code ("TX", "ON") means that region, not every city containing "on".
    const isCode = [...US_STATES, ...CA_PROVINCES].some((r) => r.code.toLowerCase() === parts[0].toLowerCase());
    return { city: isCode ? null : parts[0], regions: matchRegions(parts[0]), regionOnly: false };
  }
  // "City, Region[, Country]": the second part names the region.
  return { city: parts[0], regions: matchRegions(parts[1]), regionOnly: true };
}
