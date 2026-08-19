export function isTruthyBibTeXFlag(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes';
}

export function isPublicationHidden(tags: Record<string, string>): boolean {
  return isTruthyBibTeXFlag(tags.hidden);
}
