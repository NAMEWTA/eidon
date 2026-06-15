export interface TemplateVisualIdentity {
  glyph: string;
  color: string;
}

const TEMPLATE_COLORS = [
  'oklch(0.58 0.13 32)',
  'oklch(0.56 0.11 230)',
  'oklch(0.55 0.12 145)',
  'oklch(0.57 0.12 285)',
  'oklch(0.58 0.10 190)',
  'oklch(0.56 0.10 75)',
  'oklch(0.58 0.12 330)',
  'oklch(0.54 0.08 255)',
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function firstGlyph(name: string, fallback: string): string {
  const trimmed = name.trim();
  if (trimmed) return Array.from(trimmed)[0] ?? fallback;
  return Array.from(fallback)[0] ?? 'T';
}

export function templateDisplayName(input: {
  templateName?: string;
  l1Name?: string;
  l2Name?: string;
  l3Name?: string;
}): string {
  const explicit = input.templateName?.trim();
  if (explicit) return explicit;
  return [input.l1Name, input.l2Name, input.l3Name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' / ');
}

export function deriveTemplateVisual(input: {
  templateId: string;
  name?: string;
}): TemplateVisualIdentity {
  const seed = `${input.templateId}:${input.name ?? ''}`;
  const index = hashString(seed) % TEMPLATE_COLORS.length;
  return {
    glyph: firstGlyph(input.name ?? '', input.templateId),
    color: TEMPLATE_COLORS[index],
  };
}
