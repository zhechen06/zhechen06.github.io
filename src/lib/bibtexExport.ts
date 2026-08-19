export interface ParsedBibTeXEntry {
  entryType: string;
  citationKey: string;
  entryTags: Record<string, string>;
}

export const PUBLICATION_BIBTEX_EXPORT_EXCLUDED_FIELDS = [
  'selected',
  'preview',
  'description',
  'keywords',
  'code',
  'sci',
  'sciif',
  'accepted',
  'corresponding',
  'hidden',
];

export function reconstructBibTeX(entry: ParsedBibTeXEntry, excludeFields: string[] = []): string {
  const { entryType, citationKey, entryTags } = entry;
  const excluded = new Set(excludeFields.map(field => field.toLowerCase()));
  const fields = Object.entries(entryTags).filter(([key]) => !excluded.has(key.toLowerCase()));

  const lines = fields.map(([key, value]) => `  ${key} = {${value}}`);
  return `@${entryType}{${citationKey},\n${lines.join(',\n')}\n}`;
}
