import { uid, type Attachment, type Pact, type Section } from "./model";

export const FILE_LIMIT = 1_500_000;
export const FILE_TEXT = 8_000;
export const FILE_COUNT = 4;
export const TITLE_LIMIT = 80;
export const SECTION_LIMIT = 40;

const TEXT_TYPE =
  /^(text\/|application\/(json|xml|csv|javascript|typescript|x-yaml|yaml)|application\/[\w.+-]*\+json$)/i;
const TEXT_EXT =
  /\.(txt|md|markdown|json|csv|tsv|xml|html|css|js|mjs|ts|tsx|jsx|yml|yaml|log)$/i;

export function isTextFile(name: string, type: string) {
  return TEXT_TYPE.test(type) || TEXT_EXT.test(name);
}

export function describeAttachment(input: {
  name: string;
  type: string;
  size: number;
  text?: string;
}): { attachment?: Attachment; error?: string } {
  const name = input.name.trim().slice(0, 180);
  if (!name) return { error: "Choose a file with a name." };
  if (input.size > FILE_LIMIT)
    return { error: `${name} is larger than 1.5 MB.` };
  const readable = isTextFile(name, input.type) && typeof input.text === "string";
  const text = readable ? input.text!.slice(0, FILE_TEXT) : undefined;
  return {
    attachment: {
      id: uid(),
      name,
      mediaType: input.type || "application/octet-stream",
      size: input.size,
      ...(text !== undefined
        ? { text, truncated: (input.text?.length ?? 0) > FILE_TEXT }
        : {}),
    },
  };
}

function clean(value: string, limit: number) {
  const next = value.trim().replace(/\s+/g, " ").slice(0, limit);
  if (!next) throw new Error("Give this a name.");
  return next;
}

export function renamePact(pact: Pact, title: string): Pact {
  return { ...pact, title: clean(title, TITLE_LIMIT), titleEdited: true };
}

export function markArchived(pact: Pact, archived: boolean): Pact {
  return { ...pact, archived };
}

export function deletePact(pacts: readonly Pact[], id: string) {
  return pacts.filter((pact) => pact.id !== id);
}

export function createSection(sections: readonly Section[], name: string) {
  const cleanName = clean(name, SECTION_LIMIT);
  if (sections.some((section) => section.name.toLowerCase() === cleanName.toLowerCase()))
    throw new Error("You already have a section with that name.");
  return [...sections, { id: uid(), name: cleanName }];
}

export function renameSection(
  sections: readonly Section[],
  id: string,
  name: string,
) {
  const cleanName = clean(name, SECTION_LIMIT);
  if (
    sections.some(
      (section) =>
        section.id !== id && section.name.toLowerCase() === cleanName.toLowerCase(),
    )
  )
    throw new Error("You already have a section with that name.");
  return sections.map((section) =>
    section.id === id ? { ...section, name: cleanName } : section,
  );
}

export function removeSection(
  sections: readonly Section[],
  pacts: readonly Pact[],
  id: string,
) {
  return {
    sections: sections.filter((section) => section.id !== id),
    pacts: pacts.map((pact) =>
      pact.sectionId === id ? { ...pact, sectionId: undefined } : pact,
    ),
  };
}

export function movePact(pact: Pact, sectionId?: string): Pact {
  if (!sectionId) {
    const { sectionId: _removed, ...rest } = pact;
    return rest;
  }
  return { ...pact, sectionId };
}

export function groupedPacts(pacts: readonly Pact[], sections: readonly Section[]) {
  const known = new Set(sections.map((section) => section.id));
  const groups: { section?: Section; pacts: Pact[] }[] = sections.map(
    (section) => ({
      section,
      pacts: pacts.filter((pact) => pact.sectionId === section.id),
    }),
  );
  const loose = pacts.filter(
    (pact) => !pact.sectionId || !known.has(pact.sectionId),
  );
  if (loose.length || sections.length === 0)
    groups.push({ pacts: loose });
  return groups;
}
