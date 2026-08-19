import { notFound } from 'next/navigation';
import { getPageConfig, getMarkdownContent, getBibtexContent } from '@/lib/content';
import { getConfig } from '@/lib/config';
import { getGoogleScholarMetrics } from '@/lib/googleScholar';
import { parseBibTeX } from '@/lib/bibtexParser';
import DynamicPageClient, { type DynamicPageLocaleData } from '@/components/pages/DynamicPageClient';
import {
  BasePageConfig,
  PublicationPageConfig,
  TextPageConfig,
  CardPageConfig,
  PdfPageConfig,
} from '@/types/page';

import { Metadata } from 'next';
import { getRuntimeI18nConfig } from '@/lib/i18n/config';

async function loadDynamicPageData(slug: string, locale?: string): Promise<DynamicPageLocaleData | null> {
  const pageConfig = getPageConfig(slug, locale) as BasePageConfig | null;

  if (!pageConfig) {
    return null;
  }

  if (pageConfig.type === 'publication') {
    const pubConfig = pageConfig as PublicationPageConfig;
    const siteConfig = getConfig(locale);
    const bibtex = getBibtexContent(pubConfig.source, locale);
    const googleScholarUrl = siteConfig.social.google_scholar;

    return {
      type: 'publication',
      config: pubConfig,
      publications: parseBibTeX(bibtex, locale),
      scholarMetrics: await getGoogleScholarMetrics(googleScholarUrl),
      googleScholarUrl,
    };
  }

  if (pageConfig.type === 'text') {
    const textConfig = pageConfig as TextPageConfig;
    const content = getMarkdownContent(textConfig.source, locale);
    return {
      type: 'text',
      config: textConfig,
      content,
    };
  }

  if (pageConfig.type === 'card') {
    return {
      type: 'card',
      config: pageConfig as CardPageConfig,
    };
  }

  if (pageConfig.type === 'pdf') {
    return {
      type: 'pdf',
      config: pageConfig as PdfPageConfig,
    };
  }

  return null;
}

export function generateStaticParams() {
  const config = getConfig();
  return config.navigation
    .filter((nav) => nav.type === 'page' && nav.target !== 'about')
    .map((nav) => ({
      slug: nav.target,
    }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pageConfig = getPageConfig(slug) as BasePageConfig | null;

  if (!pageConfig) {
    return {};
  }

  return {
    title: pageConfig.title,
    description: pageConfig.description,
  };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const baseConfig = getConfig();
  const runtimeI18n = getRuntimeI18nConfig(baseConfig.i18n);
  const targetLocales = runtimeI18n.enabled ? runtimeI18n.locales : [runtimeI18n.defaultLocale];

  const dataByLocale: Record<string, DynamicPageLocaleData> = {};

  for (const locale of targetLocales) {
    const localizedData = await loadDynamicPageData(slug, locale);
    if (localizedData) {
      dataByLocale[locale] = localizedData;
    }
  }

  if (!dataByLocale[runtimeI18n.defaultLocale]) {
    const defaultData = await loadDynamicPageData(slug);
    if (defaultData) {
      dataByLocale[runtimeI18n.defaultLocale] = defaultData;
    }
  }

  if (Object.keys(dataByLocale).length === 0) {
    notFound();
  }

  return <DynamicPageClient dataByLocale={dataByLocale} defaultLocale={runtimeI18n.defaultLocale} />;
}
