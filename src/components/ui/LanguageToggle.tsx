'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LanguageIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useLocaleStore } from '@/lib/stores/localeStore';
import type { I18nRuntimeConfig } from '@/types/i18n';

interface LanguageToggleProps {
  i18n: I18nRuntimeConfig;
}

export default function LanguageToggle({ i18n }: LanguageToggleProps) {
  const { locale, setLocale } = useLocaleStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!i18n.enabled || !i18n.switcher || i18n.locales.length <= 1) {
    return null;
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-14 h-10">
        <div className="w-8 h-4 rounded-full bg-neutral-300 animate-pulse" />
      </div>
    );
  }

  const currentLocale = i18n.locales.includes(locale) ? locale : i18n.defaultLocale;
  const currentIndex = i18n.locales.indexOf(currentLocale);
  const nextLocale = i18n.locales[(currentIndex + 1) % i18n.locales.length] || i18n.defaultLocale;
  const currentLabel = i18n.labels[currentLocale] || currentLocale.toUpperCase();
  const nextLabel = i18n.labels[nextLocale] || nextLocale.toUpperCase();
  const shortLabel = currentLocale.toUpperCase();

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setLocale(nextLocale)}
        className={cn(
          'flex items-center justify-center gap-1.5 h-10 px-1 bg-transparent',
          'transition-all duration-200 focus:outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-accent/50',
          'text-ui-muted hover:text-ui-accent'
        )}
        title={`${currentLabel}. Click to switch to ${nextLabel}.`}
      >
        <LanguageIcon className="h-4 w-4" />
        <motion.span
          key={currentLocale}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs font-semibold tracking-normal"
        >
          {shortLabel}
        </motion.span>
      </motion.button>
    </div>
  );
}
