export interface ParsedPublicationAuthor {
  name: string;
  isHighlighted?: boolean;
  isCorresponding?: boolean;
}

export function normalizePersonNameForMatch(name: string): string {
  return name.toLowerCase().replace(/[\s.,'’`"()\-_/]/g, '');
}

export function splitBibTeXNames(names: string): string[] {
  return names
    .split(/\s+and\s+/i)
    .map(name => name.trim())
    .filter(Boolean);
}

export function formatBibTeXPersonName(rawName: string): string {
  const cleaned = rawName.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  const commaParts = cleaned.split(',').map(part => part.trim());

  if (commaParts.length === 2) {
    const [family, given] = commaParts;
    return `${given} ${family}`.trim();
  }

  if (commaParts.length === 3) {
    const [family, suffix, given] = commaParts;
    return `${given} ${family}${suffix ? `, ${suffix}` : ''}`.trim();
  }

  return cleaned;
}

export function personNameKey(rawName: string): string {
  return normalizePersonNameForMatch(formatBibTeXPersonName(rawName));
}

function buildNameVariants(name: string): Set<string> {
  const variants = new Set<string>();
  const cleaned = name.replace(/[{}]/g, '').toLowerCase().trim();

  if (!cleaned) {
    return variants;
  }

  const addVariant = (value: string) => {
    const variant = value.replace(/\s+/g, ' ').trim();
    if (!variant) return;

    variants.add(normalizePersonNameForMatch(variant));

    const parts = variant.split(/\s+/).filter(Boolean);
    if (parts.length === 2) {
      variants.add(normalizePersonNameForMatch(`${parts[1]} ${parts[0]}`));
    }
  };

  addVariant(cleaned);
  addVariant(cleaned.replace(/\s*\([^)]*\)\s*/g, ' '));

  return variants;
}

export function parsePublicationAuthors(
  authorsStr: string,
  correspondingStr: string,
  highlightNames: string[],
): ParsedPublicationAuthor[] {
  if (!authorsStr) return [];

  const highlightKeys = new Set<string>();
  highlightNames.forEach(name => {
    buildNameVariants(name).forEach(variant => highlightKeys.add(variant));
  });
  const correspondingNames = new Set(splitBibTeXNames(correspondingStr).map(personNameKey));

  return splitBibTeXNames(authorsStr).map(rawName => {
    const normalizedName = personNameKey(rawName);
    return {
      name: formatBibTeXPersonName(rawName),
      isHighlighted: highlightKeys.has(normalizedName),
      isCorresponding: correspondingNames.has(normalizedName),
    };
  });
}
