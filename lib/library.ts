import type { Pact, PactSection } from "./model";

export function normalizeSections(raw: unknown): PactSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PactSection =>
        !!item &&
        typeof item === "object" &&
        typeof (item as PactSection).id === "string" &&
        typeof (item as PactSection).name === "string",
    )
    .map((item) => ({
      id: item.id,
      name: item.name.trim().slice(0, 60) || "Section",
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : new Date().toISOString(),
    }));
}

export function sortLibraryPacts(list: readonly Pact[]): Pact[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

export type LibraryGroup = {
  id: string | null;
  name: string;
  pacts: Pact[];
};

/** Pinned first as its own group, then sections, then unsorted. */
export function groupLibraryPacts(
  list: readonly Pact[],
  sections: readonly PactSection[],
  opts: { archived: boolean; query: string },
): LibraryGroup[] {
  const needle = opts.query.trim().toLowerCase();
  const matches = (p: Pact) => {
    if (p.deletedAt || !!p.archived !== opts.archived) return false;
    if (!needle) return true;
    if (`${p.title} ${p.intention}`.toLowerCase().includes(needle)) return true;
    return p.messages.some((m) => m.text.toLowerCase().includes(needle));
  };
  const filtered = sortLibraryPacts(list.filter(matches));
  const pinned = filtered.filter((p) => p.pinned);
  const unpinned = filtered.filter((p) => !p.pinned);
  const groups: LibraryGroup[] = [];
  if (pinned.length)
    groups.push({ id: "__pinned__", name: "Pinned", pacts: pinned });
  for (const section of sections) {
    const pacts = unpinned.filter((p) => p.sectionId === section.id);
    if (pacts.length) groups.push({ id: section.id, name: section.name, pacts });
  }
  const loose = unpinned.filter(
    (p) => !p.sectionId || !sections.some((s) => s.id === p.sectionId),
  );
  if (loose.length || (!sections.length && !pinned.length))
    groups.push({ id: null, name: "Pacts", pacts: loose });
  return groups;
}
