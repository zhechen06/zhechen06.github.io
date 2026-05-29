import { getConfig } from '@/lib/config';
import { getMarkdownContent, getBibtexContent, getTomlContent, getPageConfig } from '@/lib/content';
import { parseBibTeX } from '@/lib/bibtexParser';
import HomePageClient, { type HomePageLocaleData } from '@/components/home/HomePageClient';
import { Publication } from '@/types/publication';
import { BasePageConfig, PublicationPageConfig, TextPageConfig, CardPageConfig, PdfPageConfig } from '@/types/page';
import { getRuntimeI18nConfig } from '@/lib/i18n/config';

interface SectionConfig {
  id: string;
  type: 'markdown' | 'publications' | 'list' | 'awards';
  title?: string;
  description?: string;
  source?: string;
  filter?: string;
  limit?: number;
  keys?: string[];
  content?: string;
  publications?: Publication[];
  items?: NewsItem[];
  cardConfig?: CardPageConfig;
}

interface NewsItem {
  date: string;
  tag?: string;
  content: string;
  links?: {
    label: string;
    url: string;
  }[];
}

type PageData =
  | { type: 'about'; id: string; sections: SectionConfig[] }
  | { type: 'publication'; id: string; config: PublicationPageConfig; publications: Publication[] }
  | { type: 'text'; id: string; config: TextPageConfig; content: string }
  | { type: 'card'; id: string; config: CardPageConfig }
  | { type: 'pdf'; id: string; config: PdfPageConfig };

function getDefaultSelectedPublications(publications: Publication[], limit: number): Publication[] {
  const explicitlySelected = publications.filter((publication) => publication.selected);

  if (explicitlySelected.length > 0) {
    return explicitlySelected.slice(0, limit);
  }

  return publications
    .filter((publication) => publication.authors[0]?.isHighlighted && typeof publication.impactFactor === 'number')
    .sort((a, b) => {
      const impactDiff = (b.impactFactor || 0) - (a.impactFactor || 0);
      if (impactDiff !== 0) return impactDiff;
      if (b.year !== a.year) return b.year - a.year;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

function processSections(sections: SectionConfig[], locale?: string): SectionConfig[] {
  return sections.map((section: SectionConfig) => {
    switch (section.type) {
      case 'markdown':
        return {
          ...section,
          content: section.source ? getMarkdownContent(section.source, locale) : '',
        };
      case 'publications': {
        const bibtex = getBibtexContent('publications.bib', locale);
        const allPubs = parseBibTeX(bibtex, locale);
        const limit = section.limit || 5;
        const filteredPubs = section.filter === 'selected'
          ? getDefaultSelectedPublications(allPubs, limit)
          : allPubs.slice(0, limit);
        return {
          ...section,
          publications: filteredPubs,
        };
      }
      case 'list': {
        const newsData = section.source ? getTomlContent<{ news: NewsItem[] }>(section.source, locale) : null;
        return {
          ...section,
          items: newsData?.news || [],
        };
      }
      case 'awards': {
        const awardsConfig = section.source ? getTomlContent<CardPageConfig>(section.source, locale) : null;
        const selectedKeys = section.keys || [];
        const selectedItems = selectedKeys
          .map((key) => awardsConfig?.items.find((item) => item.id === key))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return {
          ...section,
          cardConfig: awardsConfig ? {
            ...awardsConfig,
            title: section.title || awardsConfig.title,
            description: section.description,
            items: selectedItems,
          } : undefined,
        };
      }
      default:
        return section;
    }
  });
}

function loadPageDataForLocale(locale: string | undefined): HomePageLocaleData {
  const localeConfig = getConfig(locale);
  const enableOnePageMode = localeConfig.features.enable_one_page_mode;

  const aboutConfig = getPageConfig<{ profile?: { research_interests?: string[] }; sections?: SectionConfig[] }>('about', locale);
  const researchInterests = aboutConfig?.profile?.research_interests;

  let pagesToShow: PageData[] = [];

  if (enableOnePageMode) {
    pagesToShow = localeConfig.navigation
      .filter((item) => item.type === 'page' && !item.hide_from_nav)
      .map((item) => {
        const rawConfig = getPageConfig(item.target, locale);
        if (!rawConfig) return null;

        const pageConfig = rawConfig as BasePageConfig;

        if (pageConfig.type === 'about' || 'sections' in (rawConfig as object)) {
          return {
            type: 'about',
            id: item.target,
            sections: processSections((rawConfig as { sections: SectionConfig[] }).sections || [], locale),
          } as PageData;
        }

        if (pageConfig.type === 'publication') {
          const pubConfig = pageConfig as PublicationPageConfig;
          const bibtex = getBibtexContent(pubConfig.source, locale);
          return {
            type: 'publication',
            id: item.target,
            config: pubConfig,
            publications: parseBibTeX(bibtex, locale),
          } as PageData;
        }

        if (pageConfig.type === 'text') {
          const textConfig = pageConfig as TextPageConfig;
          return {
            type: 'text',
            id: item.target,
            config: textConfig,
            content: getMarkdownContent(textConfig.source, locale),
          } as PageData;
        }

        if (pageConfig.type === 'card') {
          return {
            type: 'card',
            id: item.target,
            config: pageConfig as CardPageConfig,
          } as PageData;
        }

        if (pageConfig.type === 'pdf') {
          return {
            type: 'pdf',
            id: item.target,
            config: pageConfig as PdfPageConfig,
          } as PageData;
        }

        return null;
      })
      .filter((item): item is PageData => item !== null);
  } else if (aboutConfig) {
    pagesToShow = [{
      type: 'about',
      id: 'about',
      sections: processSections(aboutConfig.sections || [], locale),
    }];
  }

  return {
    author: localeConfig.author,
    social: localeConfig.social,
    features: localeConfig.features,
    enableOnePageMode,
    researchInterests,
    pagesToShow,
  };
}

export default function Home() {
  const baseConfig = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(baseConfig.i18n);
  const targetLocales = runtimeI18n.enabled ? runtimeI18n.locales : [runtimeI18n.defaultLocale];

  const dataByLocale: Record<string, HomePageLocaleData> = {};

  for (const locale of targetLocales) {
    dataByLocale[locale] = loadPageDataForLocale(locale);
  }

  if (!dataByLocale[runtimeI18n.defaultLocale]) {
    dataByLocale[runtimeI18n.defaultLocale] = loadPageDataForLocale(undefined);
  }

  return <HomePageClient dataByLocale={dataByLocale} defaultLocale={runtimeI18n.defaultLocale} />;
}
