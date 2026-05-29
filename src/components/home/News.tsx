'use client';

import { motion } from 'framer-motion';
import { useMessages } from '@/lib/i18n/useMessages';

export interface NewsItem {
    date: string;
    tag?: string;
    content: string;
    links?: {
        label: string;
        url: string;
    }[];
}

interface NewsProps {
    items: NewsItem[];
    title?: string;
}

const yearMonthFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
});

function getComparableYearMonth(dateText: string): string | null {
    const match = dateText.match(/^(\d{4})-(\d{2})/);
    if (!match) return null;

    return `${match[1]}-${match[2]}`;
}

function getCurrentYearMonth(): string {
    const parts = yearMonthFormatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;

    return `${year}-${month}`;
}

function getTagClassName(tag?: string): string {
    switch (tag) {
        case 'Award':
        case '奖项':
            return 'text-rose-700 dark:text-rose-300';
        case 'Paper':
        case '论文':
            return 'text-sky-700 dark:text-sky-300';
        case 'Talk':
        case '报告':
            return 'text-emerald-700 dark:text-emerald-300';
        case 'Service':
        case '服务':
            return 'text-violet-700 dark:text-violet-300';
        case 'Career':
        case '履历':
            return 'text-amber-700 dark:text-amber-300';
        default:
            return 'text-ui-muted';
    }
}

export default function News({ items, title }: NewsProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.news;
    const currentYearMonth = getCurrentYearMonth();
    const visibleItems = items.filter((item) => {
        const itemYearMonth = getComparableYearMonth(item.date);
        return !itemYearMonth || itemYearMonth <= currentYearMonth;
    });

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
        >
            <h2 className="text-2xl font-serif font-bold text-ui-heading mb-4">{resolvedTitle}</h2>
            <div className="space-y-3">
                {visibleItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3">
                        <span className="mt-0.5 w-[4.75rem] flex-shrink-0 whitespace-nowrap text-sm tabular-nums text-ui-muted">
                            {item.date}
                        </span>
                        <div className="min-w-0 text-base leading-relaxed text-ui-body">
                            <p>
                                {item.tag && (
                                    <span className={`mr-1 font-bold italic ${getTagClassName(item.tag)}`}>
                                        {item.tag}:
                                    </span>
                                )}
                                {item.content}
                                {item.links?.length ? (
                                    <span className="ml-2 inline-flex flex-wrap gap-x-2 gap-y-1">
                                        {item.links.map((link) => (
                                            <a
                                                key={`${link.label}-${link.url}`}
                                                href={link.url}
                                                target={link.url.startsWith('/') ? undefined : '_blank'}
                                                rel={link.url.startsWith('/') ? undefined : 'noopener noreferrer'}
                                                className="text-ui-accent underline decoration-ui-accent/30 underline-offset-4 transition-colors hover:text-ui-heading"
                                            >
                                                {link.label}
                                            </a>
                                        ))}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </motion.section>
    );
}
