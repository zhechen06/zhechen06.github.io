'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { CardItem, CardPageConfig } from '@/types/page';
import { useMessages } from '@/lib/i18n/useMessages';
import { cn } from '@/lib/utils';

const markdownComponents = {
    p: ({ children }: React.ComponentProps<'p'>) => <p className="mb-3 last:mb-0">{children}</p>,
    ul: ({ children }: React.ComponentProps<'ul'>) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: React.ComponentProps<'ol'>) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: React.ComponentProps<'li'>) => <li className="mb-1">{children}</li>,
    a: ({ ...props }) => (
        <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ui-accent underline decoration-ui-accent/40 underline-offset-4 transition-colors hover:text-ui-heading"
        />
    ),
    blockquote: ({ children }: React.ComponentProps<'blockquote'>) => (
        <blockquote className="border-l-4 border-accent/50 pl-4 italic my-4 text-ui-muted">
            {children}
        </blockquote>
    ),
    strong: ({ children }: React.ComponentProps<'strong'>) => <strong className="font-semibold text-ui-heading">{children}</strong>,
    em: ({ children }: React.ComponentProps<'em'>) => <em className="italic">{children}</em>,
    code: ({ children }: React.ComponentProps<'code'>) => (
        <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-[0.95em] text-ui-body dark:bg-neutral-800">{children}</code>
    ),
};

function getPlainText(children: React.ReactNode): string {
    if (typeof children === 'string' || typeof children === 'number') {
        return String(children);
    }

    if (Array.isArray(children)) {
        return children.map(getPlainText).join('');
    }

    return '';
}

const compactMarkdownComponents = {
    ...markdownComponents,
    a: ({ children, ...props }: React.ComponentProps<'a'>) => {
        const label = getPlainText(children).trim();
        if (/^(Source|来源)(\s+\d+)?$/i.test(label)) {
            return null;
        }

        return markdownComponents.a({ ...props, children });
    },
};

const passiveTagClass = "inline-flex items-center rounded-md border border-transparent bg-neutral-100 px-3 py-1 text-xs font-medium text-ui-body dark:border-white/15 dark:bg-white/15 dark:text-slate-50";

function getDisplayDate(date: string, yearOnly: boolean): string {
    if (!yearOnly) {
        return date;
    }

    const yearMatch = date.match(/^\d{4}/);
    return yearMatch ? yearMatch[0] : date;
}

function getAwardTagFilterKey(tagIndex: number, itemIndexes: number[]): string {
    return `${tagIndex}:${itemIndexes.join(',')}`;
}

function groupItems(items: CardItem[]): Array<{ title?: string; items: CardItem[] }> {
    const groups: Array<{ title?: string; items: CardItem[] }> = [];

    items.forEach((item) => {
        const current = groups[groups.length - 1];
        if (current && current.title === item.section) {
            current.items.push(item);
            return;
        }

        groups.push({ title: item.section, items: [item] });
    });

    return groups;
}

export default function CardPage({
    config,
    embedded = false,
    compact = false,
    viewAllHref,
}: {
    config: CardPageConfig;
    embedded?: boolean;
    compact?: boolean;
    viewAllHref?: string;
}) {
    const messages = useMessages();
    const [selectedAwardTagKeys, setSelectedAwardTagKeys] = useState<string[]>([]);
    const titleLower = config.title.toLowerCase();
    const showDateWithTags = titleLower.includes('award') || titleLower.includes('honor') || config.title.includes('奖');
    const showHeader = !config.hide_title && Boolean(config.title || config.description);
    const showAwardFilters = showDateWithTags && !embedded;
    const awardTagData = useMemo(() => {
        if (!showAwardFilters) {
            return {
                stats: [] as Array<{ key: string; tag: string; count: number }>,
                keyByTag: new Map<string, string>(),
            };
        }

        const uniqueTags: string[] = [];
        config.items.forEach((item) => {
            item.tags?.forEach((tag) => {
                if (!uniqueTags.includes(tag)) {
                    uniqueTags.push(tag);
                }
            });
        });

        const stats = uniqueTags.map((tag, tagIndex) => {
            const itemIndexes = config.items.reduce<number[]>((indexes, item, itemIndex) => {
                if (item.tags?.includes(tag)) {
                    indexes.push(itemIndex);
                }

                return indexes;
            }, []);

            return {
                key: getAwardTagFilterKey(tagIndex, itemIndexes),
                tag,
                count: itemIndexes.length,
            };
        });

        return {
            stats,
            keyByTag: new Map(stats.map(({ tag, key }) => [tag, key])),
        };
    }, [config.items, showAwardFilters]);
    const awardTagStats = awardTagData.stats;
    const activeAwardTagKeys = useMemo(() => {
        if (!showAwardFilters) {
            return [];
        }

        const validKeys = new Set(awardTagStats.map(({ key }) => key));
        return selectedAwardTagKeys.filter((key) => validKeys.has(key));
    }, [awardTagStats, selectedAwardTagKeys, showAwardFilters]);
    const displayedItems = useMemo(() => {
        if (!showAwardFilters || activeAwardTagKeys.length === 0) {
            return config.items;
        }

        return config.items.filter(item =>
            item.tags?.some((tag) => {
                const key = awardTagData.keyByTag.get(tag);
                return key ? activeAwardTagKeys.includes(key) : false;
            })
        );
    }, [activeAwardTagKeys, awardTagData.keyByTag, config.items, showAwardFilters]);
    const awardFilterCardBaseClass =
        "flex min-h-[5rem] flex-col items-start justify-center gap-1.5 rounded-lg border px-4 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40";
    const getAwardFilterCardClass = (isActive: boolean) => cn(
        awardFilterCardBaseClass,
        isActive
            ? "border-accent bg-accent text-white shadow-lg shadow-accent/20"
            : "frosted-surface border-neutral-200 dark:border-neutral-800"
    );
    const getAwardFilterNumberClass = (isActive: boolean) => cn(
        "flex items-center justify-start text-2xl font-semibold leading-none tabular-nums",
        isActive ? "text-white" : "text-ui-heading"
    );
    const getAwardFilterLabelClass = (isActive: boolean) => cn(
        "flex items-center justify-start text-sm font-medium leading-snug",
        isActive ? "text-white/90" : "text-ui-muted"
    );
    const setAwardTagFilter = (key: string) => {
        setSelectedAwardTagKeys(current => current.length === 1 && current[0] === key ? [] : [key]);
    };

    if (config.layout === 'list') {
        const groups = groupItems(config.items);

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
            >
                {showHeader && (
                    <div className={embedded ? "mb-4" : "mb-8"}>
                        {config.title && (
                            <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-ui-heading mb-4`}>{config.title}</h1>
                        )}
                        {config.description && (
                            <div className={`${embedded ? "text-base" : "text-lg"} text-ui-muted max-w-2xl leading-relaxed`}>
                                <ReactMarkdown components={markdownComponents}>
                                    {config.description}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                )}

                <div className={embedded ? "space-y-7" : "space-y-9"}>
                    {groups.map((group, groupIndex) => (
                        <section key={`${group.title || 'items'}-${groupIndex}`} className="space-y-3">
                            {group.title && (
                                <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-ui-heading mb-4`}>
                                    {group.title}
                                </h1>
                            )}
                            <ol className="divide-y divide-neutral-200/80 border-y border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                                {group.items.map((item, index) => {
                                    const hasImage = Boolean(item.image);
                                    const displayDate = item.date ? getDisplayDate(item.date, showDateWithTags) : '';
                                    const hasDate = Boolean(displayDate);

                                    return (
                                        <motion.li
                                            key={`${item.title}-${index}`}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.35, delay: 0.06 * (groupIndex + index) }}
                                            className={hasDate ? "grid gap-3 py-4 sm:grid-cols-[5rem_1fr] sm:gap-5" : "py-4"}
                                        >
                                            {hasDate && (
                                                <div className="whitespace-nowrap text-center text-sm font-semibold text-ui-accent">
                                                    {displayDate}
                                                </div>
                                            )}
                                            <div className={hasImage ? "grid min-w-0 gap-4 md:grid-cols-[180px_1fr] md:items-center" : "min-w-0"}>
                                                {item.image && (
                                                    <div className="relative h-44 overflow-hidden md:h-36">
                                                        <Image
                                                            src={item.image}
                                                            alt={`${item.title} certificate`}
                                                            fill
                                                            sizes="(min-width: 768px) 180px, 100vw"
                                                            className="object-contain"
                                                        />
                                                    </div>
                                                )}

                                                <div className="min-w-0">
                                                    <h3 className={`${embedded ? "text-base" : "text-lg"} font-semibold leading-snug text-ui-heading`}>
                                                        {item.title}
                                                    </h3>
                                                    {item.subtitle && (
                                                        <p className="mt-1 text-base font-medium leading-relaxed text-ui-body">
                                                            {item.subtitle}
                                                        </p>
                                                    )}
                                                    {item.content && (
                                                        <div className="mt-2 text-base leading-relaxed text-ui-body">
                                                            <ReactMarkdown components={markdownComponents}>
                                                                {item.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.li>
                                    );
                                })}
                            </ol>
                        </section>
                    ))}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            {showHeader && (
                <div className={embedded ? "mb-4" : "mb-8"}>
                    {config.title && (
                        <div className="mb-4 flex items-center justify-between">
                            <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-ui-heading`}>{config.title}</h1>
                            {viewAllHref && (
                                <Link
                                    href={viewAllHref}
                                    prefetch={true}
                                    className="text-ui-accent text-sm font-medium transition-all duration-200 rounded hover:bg-accent/10 hover:shadow-sm"
                                >
                                    {messages.home.viewAll} →
                                </Link>
                            )}
                        </div>
                    )}
                    {config.description && (
                        <div className={`${embedded ? "text-base" : "text-lg"} text-ui-muted max-w-2xl leading-relaxed`}>
                            <ReactMarkdown components={markdownComponents}>
                                {config.description}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            )}

            {showAwardFilters && awardTagStats.length > 0 && (
                <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => setSelectedAwardTagKeys([])}
                        aria-pressed={activeAwardTagKeys.length === 0}
                        className={getAwardFilterCardClass(activeAwardTagKeys.length === 0)}
                    >
                        <div className={getAwardFilterNumberClass(activeAwardTagKeys.length === 0)}>
                            {config.items.length}
                        </div>
                        <div className={getAwardFilterLabelClass(activeAwardTagKeys.length === 0)}>
                            {messages.common.all}
                        </div>
                    </button>
                    {awardTagStats.map(({ key, tag, count }) => {
                        const isActive = activeAwardTagKeys.includes(key);

                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setAwardTagFilter(key)}
                                aria-pressed={isActive}
                                className={getAwardFilterCardClass(isActive)}
                            >
                                <div className={getAwardFilterNumberClass(isActive)}>
                                    {count}
                                </div>
                                <div className={getAwardFilterLabelClass(isActive)}>
                                    {tag}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={`grid ${embedded ? "gap-4" : "gap-6"}`}>
                {displayedItems.map((item, index) => {
                    const hasImage = Boolean(item.image);
                    const itemKey = item.id || `${item.title}-${item.date ?? index}`;
                    const displayDate = item.date ? getDisplayDate(item.date, showDateWithTags) : '';

                    return (
                        <div
                            key={itemKey}
                            className={`frosted-surface bg-white dark:bg-neutral-900 ${compact ? "p-[1.05rem]" : embedded ? "p-4" : "p-6"} rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]`}
                        >
                            <div className={hasImage ? compact ? "flex flex-col gap-6 md:flex-row md:items-center" : "grid gap-5 md:grid-cols-[220px_1fr] md:items-center" : ""}>
                                {item.image && (
                                    compact ? (
                                        <div className="w-full max-w-[6.53rem] mx-auto md:mx-0 md:w-[5.44rem] flex-shrink-0">
                                            <div className="aspect-[210/297] relative overflow-hidden">
                                                {/* Center-crop landscape award images into a portrait A4 preview. */}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.image}
                                                    alt={`${item.title} certificate`}
                                                    loading="lazy"
                                                    className="h-full w-full object-cover object-center"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center overflow-hidden">
                                            {/* Native img keeps mixed-aspect certificate files at their natural ratio. */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.image}
                                                alt={`${item.title} certificate`}
                                                loading="lazy"
                                                className="block max-h-56 max-w-full object-contain md:max-h-48"
                                            />
                                        </div>
                                    )
                                )}

                                <div className="min-w-0 flex-grow">
                                    <div className="flex justify-between items-start gap-4 mb-2">
                                        <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold leading-tight text-ui-heading`}>{item.title}</h3>
                                        {item.date && !showDateWithTags && (
                                            <span className={`-mt-1 shrink-0 ${passiveTagClass}`}>
                                                {displayDate}
                                            </span>
                                        )}
                                    </div>
                                    {item.subtitle && (
                                        <p className={`${embedded ? "text-sm" : "text-base"} text-ui-accent font-medium mb-3`}>{item.subtitle}</p>
                                    )}
                                    {item.content && (
                                        <div className={`${embedded ? "text-sm" : "text-base"} text-ui-body leading-relaxed`}>
                                            <ReactMarkdown components={compact ? compactMarkdownComponents : markdownComponents}>
                                                {item.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                    {!compact && ((showDateWithTags ? displayDate : false) || item.tags) ? (
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {showDateWithTags && displayDate && (
                                                <span className={passiveTagClass}>
                                                    {displayDate}
                                                </span>
                                            )}
                                            {item.tags?.map(tag => (
                                                <span key={tag} className={passiveTagClass}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
