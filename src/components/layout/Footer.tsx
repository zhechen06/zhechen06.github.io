'use client';

import { useLocaleStore } from '@/lib/stores/localeStore';
import { useMessages } from '@/lib/i18n/useMessages';

interface FooterProps {
  lastUpdated?: string;
  lastUpdatedByLocale?: Record<string, string | undefined>;
  defaultLocale?: string;
  authorName?: string;
}

const homepageRepositoryUrl = 'https://github.com/zhechen06/zhechen06.github.io';

export default function Footer({ lastUpdated, lastUpdatedByLocale, defaultLocale = 'en', authorName }: FooterProps) {
  const locale = useLocaleStore((state) => state.locale);
  const messages = useMessages();

  const resolvedLastUpdated =
    lastUpdatedByLocale?.[locale] ||
    (defaultLocale ? lastUpdatedByLocale?.[defaultLocale] : undefined) ||
    lastUpdated ||
    new Date().toLocaleDateString(locale || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <footer>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-center items-center">
          <p className="text-xs text-ui-muted">
            {authorName ? (
              <>
                ©{' '}
                <a
                  href={homepageRepositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-ui-accent"
                >
                  {authorName}
                </a>
                {' | '}
              </>
            ) : null}
            <a
              href="https://github.com/xyjoey/PRISM"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-ui-accent"
            >
              Built with PRISM
            </a>
            {' | '}
            {messages.footer.lastUpdated}: {resolvedLastUpdated}
          </p>
        </div>
      </div>
    </footer>
  );
}
