'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { resolveTheme, useThemeStore, type Theme } from '@/lib/stores/themeStore';
import { useMessages } from '@/lib/i18n/useMessages';
import { cn } from '@/lib/utils';

type VisibleTheme = Exclude<Theme, 'system'>;

interface ThemeOption {
  value: VisibleTheme;
  label: string;
  icon: ReactNode;
}

function useThemeOptions(): ThemeOption[] {
  const messages = useMessages();

  return [
    {
      value: 'light',
      label: messages.theme.light,
      icon: <SunIcon className="h-4 w-4" />,
    },
    {
      value: 'dark',
      label: messages.theme.dark,
      icon: <MoonIcon className="h-4 w-4" />,
    },
  ];
}

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const messages = useMessages();
  const themes = useThemeOptions();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center w-10 h-10">
        <div className="w-4 h-4 rounded-full bg-neutral-300 animate-pulse" />
      </div>
    );
  }

  const effectiveTheme = resolveTheme(theme);
  const currentTheme = themes.find((t) => t.value === effectiveTheme) || themes[0];

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
        }}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-full bg-transparent',
          'transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'text-ui-muted hover:text-ui-accent'
        )}
        title={`${messages.theme.currentTheme}: ${currentTheme.label}. ${messages.theme.cycleTheme}.`}
      >
        <motion.div
          key={effectiveTheme}
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {effectiveTheme === 'dark' ? (
            <MoonIcon className="h-4 w-4" />
          ) : (
            <SunIcon className="h-4 w-4" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
}
