import { Publication, PublicationType, ResearchArea } from '@/types/publication';
import { getConfig } from './config';
import { getRuntimeI18nConfig } from './i18n/config';
import { parseBibTeXInline } from './bibtexInline';
import { parsePublicationAuthors } from './bibtexNames';
import { isPublicationHidden } from './bibtexVisibility';
import {
  PUBLICATION_BIBTEX_EXPORT_EXCLUDED_FIELDS,
  reconstructBibTeX,
} from './bibtexExport';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bibtexParse = require('bibtex-parse-js');

// Map BibTeX entry types to our publication types
const typeMapping: Record<string, PublicationType> = {
  article: 'journal',
  inproceedings: 'conference',
  conference: 'conference',
  incollection: 'book-chapter',
  book: 'book',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  techreport: 'technical-report',
  unpublished: 'preprint',
  misc: 'preprint',
};

// Convert month names to numbers
const monthMapping: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9, sept: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function normalizeDateString(value?: string): string | undefined {
  if (!value) return undefined;

  const cleaned = cleanBibTeXString(value).trim();
  if (!cleaned) return undefined;

  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const textMatch = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const [, day, monthName, year] = textMatch;
    const month = monthMapping[monthName.toLowerCase()];
    if (month) {
      return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return undefined;
}

function sortDateFromYearMonth(year: number, month?: number): string {
  return `${year}-${String(month || 1).padStart(2, '0')}-01`;
}

function publicationSortTime(publication: Publication): number {
  const date = publication.sortDate || sortDateFromYearMonth(publication.year);
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(parsed) ? publication.year : parsed;
}

export function parseBibTeX(bibtexContent: string, locale?: string): Publication[] {
  const highlightNames = getHighlightNames(locale);
  const entries = bibtexParse.toJSON(bibtexContent);
  const visibleEntries = entries.filter(
    (entry: { entryTags: Record<string, string> }) => !isPublicationHidden(entry.entryTags)
  );

  return visibleEntries.map((entry: { entryType: string; citationKey: string; entryTags: Record<string, string> }, index: number) => {
    const tags = entry.entryTags;

    // Parse authors
    const authors = parsePublicationAuthors(tags.author || '', tags.corresponding || '', highlightNames);

    // Parse year and month
    const year = parseInt(tags.year) || new Date().getFullYear();
    const monthStr = tags.month?.toLowerCase() || '';
    const month = monthMapping[monthStr] || (parseInt(monthStr) || undefined);
    const acceptedDate = normalizeDateString(
      tags.accepted || tags.accepteddate || tags.accepted_date || tags.accept_date
    );
    const sortDate = acceptedDate || sortDateFromYearMonth(year, month);

    // Determine type
    const type = typeMapping[entry.entryType.toLowerCase()] || 'journal';

    // Parse tags/keywords
    const keywords = tags.keywords?.split(',').map((k: string) => k.trim()) || [];

    // Parse selected field (convert string to boolean)
    const selected = tags.selected === 'true' || tags.selected === 'yes';

    // Parse preview field (remove braces if present)
    const preview = tags.preview?.replace(/[{}]/g, '');
    const title = parseBibTeXInline(tags.title || 'Untitled');
    const sci = cleanBibTeXString(tags.sci).trim();
    const sciif = cleanBibTeXString(tags.sciif).trim();
    const parsedImpactFactor = parseFloat(sciif);
    const hasImpactFactor = Number.isFinite(parsedImpactFactor);
    const quartile = ['Q1', 'Q2', 'Q3', 'Q4'].includes(sci)
      ? (sci as 'Q1' | 'Q2' | 'Q3' | 'Q4')
      : undefined;

    // Create publication object
    const publication: Publication = {
      id: entry.citationKey || tags.id || `pub-${Date.now()}-${index}`,
      title: title.plainText || 'Untitled',
      titleNodes: title.nodes,
      authors,
      year,
      month: monthMapping[tags.month?.toLowerCase()] ? String(month) : tags.month,
      acceptedDate,
      sortDate,
      type,
      status: 'published',
      tags: keywords,
      keywords,
      researchArea: detectResearchArea(tags.title, keywords),

      // Optional fields
      journal: cleanBibTeXString(tags.journal),
      conference: cleanBibTeXString(tags.booktitle),
      volume: tags.volume,
      issue: tags.number,
      pages: tags.pages,
      doi: tags.doi,
      url: tags.url,
      code: tags.code,
      abstract: cleanBibTeXString(tags.abstract),
      description: cleanBibTeXString(tags.description || tags.note),
      selected,
      preview,
      sci,
      sciif,
      impactFactor: hasImpactFactor ? parsedImpactFactor : undefined,
      quartile,

      // Store original BibTeX (excluding custom fields)
      bibtex: reconstructBibTeX(entry, PUBLICATION_BIBTEX_EXPORT_EXCLUDED_FIELDS),
    };

    // Clean up undefined fields
    Object.keys(publication).forEach(key => {
      if (publication[key as keyof Publication] === undefined) {
        delete publication[key as keyof Publication];
      }
    });

    return publication;
  }).sort((a: Publication, b: Publication) => {
    if (b.year !== a.year) return b.year - a.year;

    const dateDiff = publicationSortTime(b) - publicationSortTime(a);
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title);
  });
}

function getHighlightNames(locale?: string): string[] {
  const names = new Set<string>();
  const baseConfig = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(baseConfig.i18n);

  const addName = (name?: string) => {
    const cleaned = cleanBibTeXString(name).trim();
    if (cleaned) {
      names.add(cleaned);
    }
  };

  addName(baseConfig.author.name);

  if (runtimeI18n.enabled) {
    runtimeI18n.locales.forEach((localeCode) => {
      const localizedConfig = getConfig(localeCode);
      addName(localizedConfig.author.name);
    });
  }

  if (locale) {
    const currentLocaleConfig = getConfig(locale);
    addName(currentLocaleConfig.author.name);
  }

  return Array.from(names);
}

function cleanBibTeXString(str?: string): string {
  if (!str) return '';

  return parseBibTeXInline(str).plainText;
}

function detectResearchArea(title: string, keywords: string[]): ResearchArea {
  const text = (title + ' ' + keywords.join(' ')).toLowerCase();

  if (text.includes('healthcare') || text.includes('medical') || text.includes('health')) {
    return 'ai-healthcare';
  }
  if (text.includes('signal') || text.includes('processing')) {
    return 'signal-processing';
  }
  if (text.includes('reliability') || text.includes('fault') || text.includes('diagnosis')) {
    return 'reliability-engineering';
  }
  if (text.includes('quantum')) {
    return 'quantum-computing';
  }
  if (text.includes('neural') || text.includes('spiking')) {
    return 'neural-networks';
  }
  if (text.includes('transformer') || text.includes('attention')) {
    return 'transformer-architectures';
  }

  return 'machine-learning';
}
