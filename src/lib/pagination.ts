export const DEFAULT_PAGE_SIZE = 20;

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function pageArgs(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}

export function paramList(params: SearchParams, key: string): string[] {
  const value = params[key];
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}
