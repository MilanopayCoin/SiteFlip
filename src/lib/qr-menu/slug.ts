import { nanoid } from "nanoid";

/** URL-safe slug from venue name + short suffix for uniqueness */
export function makeMenuSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stem = base || "menu";
  return `${stem}-${nanoid(6).toLowerCase()}`;
}
