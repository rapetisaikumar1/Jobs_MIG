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
