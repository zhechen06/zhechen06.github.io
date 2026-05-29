'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
    MagnifyingGlassIcon,
    AcademicCapIcon,
    FunnelIcon,
    CalendarIcon,
    BookOpenIcon,
    ChartBarIcon,
    ArrowsUpDownIcon,
    ArrowTopRightOnSquareIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Publication } from '@/types/publication';
import { PublicationPageConfig, ScholarMetrics } from '@/types/page';
import { cn } from '@/lib/utils';
import { useMessages } from '@/lib/i18n/useMessages';
import FormattedBibTeXText from './FormattedBibTeXText';

interface PublicationsListProps {
    config: PublicationPageConfig;
    publications: Publication[];
    embedded?: boolean;
    scholarMetrics?: ScholarMetrics | null;
    googleScholarUrl?: string;
}

type SortMode = 'year' | 'authorship';
type AuthorshipFilter = 'first-author' | 'corresponding-author' | 'co-author';
type QuartileFilter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type ImpactFactorFilter = 'lt-5' | '5-10' | 'gt-10';

const urlStateKeys = ['q', 'year', 'author', 'journal', 'quartile', 'impact', 'sort', 'filters'];
const validAuthorshipFilters: AuthorshipFilter[] = ['first-author', 'corresponding-author', 'co-author'];
const validQuartileFilters: QuartileFilter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const validImpactFactorFilters: ImpactFactorFilter[] = ['lt-5', '5-10', 'gt-10'];

const googleScholarStatsUrl = 'https://cdn.jsdelivr.net/gh/zhechen06/zhechen06.github.io@google-scholar-stats/gs_data.json';

const passiveTagClass = "inline-flex max-w-full items-center rounded-md border border-transparent bg-neutral-100 px-3 py-1 text-left text-xs font-medium leading-snug text-ui-body dark:border-white/15 dark:bg-white/15 dark:text-slate-50";

function toggleSelection<T>(currentValues: T[], value: T): T[] {
    return currentValues.includes(value)
        ? currentValues.filter(currentValue => currentValue !== value)
        : [...currentValues, value];
}

function getPublicationVenue(pub: Publication): string {
    return pub.journal || pub.conference || pub.venue || '';
}

function getImpactFactorCategory(pub: Publication): ImpactFactorFilter | null {
    const impactFactor = getPublicationImpactFactor(pub);
    if (impactFactor < 0) return null;
    if (impactFactor < 5) return 'lt-5';
    if (impactFactor <= 10) return '5-10';
    return 'gt-10';
}

function getPublicationImpactFactor(pub: Publication): number {
    return typeof pub.impactFactor === 'number' && Number.isFinite(pub.impactFactor)
        ? pub.impactFactor
        : -1;
}

function getPublicationMonth(pub: Publication): number {
    if (!pub.month) return 1;
    const parsed = parseInt(pub.month, 10);
    return Number.isFinite(parsed) ? parsed : 1;
}

function getPublicationSortTime(pub: Publication): number {
    const sortDate = pub.sortDate || `${pub.year}-${String(getPublicationMonth(pub)).padStart(2, '0')}-01`;
    const parsed = Date.parse(`${sortDate}T00:00:00Z`);
    return Number.isNaN(parsed) ? pub.year : parsed;
}

function compareByYearThenImpact(a: Publication, b: Publication): number {
    if (b.year !== a.year) return b.year - a.year;

    const sortDateDiff = getPublicationSortTime(b) - getPublicationSortTime(a);
    if (sortDateDiff !== 0) return sortDateDiff;

    const impactDiff = getPublicationImpactFactor(b) - getPublicationImpactFactor(a);
    if (impactDiff !== 0) return impactDiff;

    const monthDiff = getPublicationMonth(b) - getPublicationMonth(a);
    if (monthDiff !== 0) return monthDiff;

    return a.title.localeCompare(b.title);
}

function parseNumberParams(values: string[]): number[] {
    return values
        .map(value => Number.parseInt(value, 10))
        .filter(value => Number.isFinite(value));
}

function parseStringParams<T extends string>(values: string[], validValues: readonly T[]): T[] {
    return values.filter((value): value is T => validValues.includes(value as T));
}

function replaceUrlState(params: URLSearchParams) {
    if (typeof window === 'undefined') return;

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
        window.history.replaceState(null, '', nextUrl);
    }
}

function getMyAuthorshipRank(pub: Publication): number {
    const highlightedIndex = pub.authors.findIndex(author => author.isHighlighted);
    if (highlightedIndex === -1) return 999;

    const highlightedAuthor = pub.authors[highlightedIndex];
    if (highlightedIndex === 0) return 0;
    if (highlightedAuthor?.isCorresponding) return 1;

    return highlightedIndex + 1;
}

function getMyAuthorshipCategory(pub: Publication): AuthorshipFilter | null {
    const highlightedIndex = pub.authors.findIndex(author => author.isHighlighted);
    if (highlightedIndex === -1) return null;

    const highlightedAuthor = pub.authors[highlightedIndex];
    if (highlightedIndex === 0) return 'first-author';
    if (highlightedAuthor?.isCorresponding) return 'corresponding-author';

    return 'co-author';
}

function compareByAuthorshipThenImpact(a: Publication, b: Publication): number {
    const authorshipDiff = getMyAuthorshipRank(a) - getMyAuthorshipRank(b);
    if (authorshipDiff !== 0) return authorshipDiff;

    const impactDiff = getPublicationImpactFactor(b) - getPublicationImpactFactor(a);
    if (impactDiff !== 0) return impactDiff;

    return compareByYearThenImpact(a, b);
}

export default function PublicationsList({
    config,
    publications,
    embedded = false,
    scholarMetrics,
    googleScholarUrl,
}: PublicationsListProps) {
    const messages = useMessages();
    const [liveScholarMetrics, setLiveScholarMetrics] = useState<ScholarMetrics | null>(null);
    const resolvedScholarMetrics = liveScholarMetrics ?? scholarMetrics ?? null;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const [selectedAuthorships, setSelectedAuthorships] = useState<AuthorshipFilter[]>([]);
    const [selectedJournals, setSelectedJournals] = useState<string[]>([]);
    const [selectedQuartiles, setSelectedQuartiles] = useState<QuartileFilter[]>([]);
    const [selectedImpactFactors, setSelectedImpactFactors] = useState<ImpactFactorFilter[]>([]);
    const [sortMode, setSortMode] = useState<SortMode>('year');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedAbstractId, setExpandedAbstractId] = useState<string | null>(null);
    const [urlStateLoaded, setUrlStateLoaded] = useState(false);
    const hasActiveFilterSelection =
        selectedYears.length > 0 ||
        selectedAuthorships.length > 0 ||
        selectedJournals.length > 0 ||
        selectedQuartiles.length > 0 ||
        selectedImpactFactors.length > 0;
    const hasNarrowedResults = hasActiveFilterSelection || searchQuery.trim().length > 0;

    useEffect(() => {
        let isMounted = true;
        const cacheKey = new Date().toISOString().slice(0, 13);

        fetch(`${googleScholarStatsUrl}?v=${cacheKey}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Google Scholar stats returned HTTP ${response.status}`);
                }
                return response.json() as Promise<{ citedby?: number; hindex?: number; updated?: string }>;
            })
            .then((stats) => {
                if (!isMounted || typeof stats.citedby !== 'number' || typeof stats.hindex !== 'number') {
                    return;
                }

                setLiveScholarMetrics({
                    citations: stats.citedby,
                    hIndex: stats.hindex,
                    sourceUrl: googleScholarUrl,
                    fetchedAt: stats.updated,
                });
            })
            .catch(() => {
                // Keep the build-time or fallback value until the stats branch exists.
            });

        return () => {
            isMounted = false;
        };
    }, [googleScholarUrl]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncStateFromUrl = () => {
            const params = new URLSearchParams(window.location.search);
            const urlYears = parseNumberParams(params.getAll('year'));
            const urlAuthorships = parseStringParams(params.getAll('author'), validAuthorshipFilters);
            const urlQuartiles = parseStringParams(params.getAll('quartile'), validQuartileFilters);
            const urlImpactFactors = parseStringParams(params.getAll('impact'), validImpactFactorFilters);
            const urlJournals = params.getAll('journal').filter(Boolean);
            const urlSortMode = params.get('sort') === 'authorship' ? 'authorship' : 'year';
            const hasUrlFilters =
                urlYears.length > 0 ||
                urlAuthorships.length > 0 ||
                urlJournals.length > 0 ||
                urlQuartiles.length > 0 ||
                urlImpactFactors.length > 0;

            setSearchQuery(params.get('q') || '');
            setSelectedYears(urlYears);
            setSelectedAuthorships(urlAuthorships);
            setSelectedJournals(urlJournals);
            setSelectedQuartiles(urlQuartiles);
            setSelectedImpactFactors(urlImpactFactors);
            setSortMode(urlSortMode);
            setShowFilters(params.get('filters') === '1' || hasUrlFilters);
            setUrlStateLoaded(true);
        };

        syncStateFromUrl();
        window.addEventListener('popstate', syncStateFromUrl);
        return () => window.removeEventListener('popstate', syncStateFromUrl);
    }, []);

    useEffect(() => {
        if (!urlStateLoaded || typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        urlStateKeys.forEach(key => params.delete(key));

        const trimmedSearch = searchQuery.trim();
        if (trimmedSearch) params.set('q', trimmedSearch);
        selectedYears.forEach(year => params.append('year', String(year)));
        selectedAuthorships.forEach(authorship => params.append('author', authorship));
        selectedJournals.forEach(journal => params.append('journal', journal));
        selectedQuartiles.forEach(quartile => params.append('quartile', quartile));
        selectedImpactFactors.forEach(impactFactor => params.append('impact', impactFactor));
        if (sortMode !== 'year') params.set('sort', sortMode);
        if (showFilters) params.set('filters', '1');

        replaceUrlState(params);
    }, [
        searchQuery,
        selectedYears,
        selectedAuthorships,
        selectedJournals,
        selectedQuartiles,
        selectedImpactFactors,
        sortMode,
        showFilters,
        urlStateLoaded,
    ]);

    const authorshipFilters = [
        { value: 'first-author' as const, label: messages.publications.authorshipFilters.firstAuthor },
        { value: 'corresponding-author' as const, label: messages.publications.authorshipFilters.correspondingAuthor },
        { value: 'co-author' as const, label: messages.publications.authorshipFilters.coAuthor },
    ];

    const impactFactorFilters = [
        { value: 'lt-5' as const, label: '<5' },
        { value: '5-10' as const, label: '5-10' },
        { value: 'gt-10' as const, label: '>10' },
    ];

    // Extract unique years for filters
    const years = useMemo(() => {
        const uniqueYears = Array.from(new Set(publications.map(p => p.year)));
        return uniqueYears.sort((a, b) => b - a);
    }, [publications]);

    const journals = useMemo(() => {
        const uniqueJournals = Array.from(
            new Set(publications.map(getPublicationVenue).filter(Boolean))
        );
        return uniqueJournals.sort((a, b) => a.localeCompare(b));
    }, [publications]);

    const quartiles = useMemo(() => {
        const uniqueQuartiles = Array.from(
            new Set(publications.map(pub => pub.quartile).filter(Boolean))
        ) as QuartileFilter[];
        return uniqueQuartiles.sort((a, b) => a.localeCompare(b));
    }, [publications]);

    const publicationStats = useMemo(() => {
        const journalPublications = publications.filter(pub => pub.type === 'journal');

        return journalPublications.reduce(
            (stats, pub) => {
                const authorshipCategory = getMyAuthorshipCategory(pub);
                if (authorshipCategory === 'first-author') {
                    stats.firstAuthor += 1;
                } else if (authorshipCategory === 'corresponding-author') {
                    stats.correspondingAuthor += 1;
                } else if (authorshipCategory === 'co-author') {
                    stats.coAuthor += 1;
                }

                return stats;
            },
            {
                firstAuthor: 0,
                correspondingAuthor: 0,
                coAuthor: 0,
            }
        );
    }, [publications]);

    // Filter publications
    const filteredPublications = useMemo(() => {
        const filtered = publications.filter(pub => {
            const matchesSearch =
                pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pub.authors.some(author => author.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                pub.journal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pub.conference?.toLowerCase().includes(searchQuery.toLowerCase());

            const venue = getPublicationVenue(pub);
            const authorshipCategory = getMyAuthorshipCategory(pub);
            const impactFactorCategory = getImpactFactorCategory(pub);
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(pub.year);
            const matchesAuthorship =
                selectedAuthorships.length === 0 ||
                (authorshipCategory !== null && selectedAuthorships.includes(authorshipCategory));
            const matchesJournal = selectedJournals.length === 0 || selectedJournals.includes(venue);
            const matchesQuartile =
                selectedQuartiles.length === 0 ||
                (pub.quartile !== undefined && selectedQuartiles.includes(pub.quartile));
            const matchesImpactFactor =
                selectedImpactFactors.length === 0 ||
                (impactFactorCategory !== null && selectedImpactFactors.includes(impactFactorCategory));

            return matchesSearch &&
                matchesYear &&
                matchesAuthorship &&
                matchesJournal &&
                matchesQuartile &&
                matchesImpactFactor;
        });

        return [...filtered].sort(sortMode === 'authorship' ? compareByAuthorshipThenImpact : compareByYearThenImpact);
    }, [
        publications,
        searchQuery,
        selectedYears,
        selectedAuthorships,
        selectedJournals,
        selectedQuartiles,
        selectedImpactFactors,
        sortMode,
    ]);

    const visiblePublicationUnit =
        filteredPublications.length === 1
            ? messages.publications.resultCount.publicationSingular
            : messages.publications.resultCount.publicationPlural;

    const setAuthorshipQuickFilter = (authorship: AuthorshipFilter) => {
        setSelectedAuthorships(current =>
            current.length === 1 && current[0] === authorship ? [] : [authorship]
        );
    };

    const statCardBaseClass =
        "flex min-h-[5rem] flex-col items-start justify-center gap-1.5 rounded-lg border px-4 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40";

    const getAuthorshipCardClass = (isActive: boolean) => cn(
        statCardBaseClass,
        isActive
            ? "border-accent bg-accent text-white shadow-lg shadow-accent/20"
            : "frosted-surface border-neutral-200 dark:border-neutral-800"
    );

    const getAuthorshipCardNumberClass = (isActive: boolean) => cn(
        "flex items-center justify-start text-2xl font-semibold leading-none tabular-nums",
        isActive ? "text-white" : "text-ui-heading"
    );

    const getAuthorshipCardLabelClass = (isActive: boolean) => cn(
        "flex items-center justify-start text-sm font-medium leading-snug",
        isActive ? "text-white/90" : "text-ui-muted"
    );

    const scholarCardClass = cn(
        statCardBaseClass,
        "frosted-surface border-neutral-200 dark:border-neutral-800"
    );

    const scholarCardNumberClass = "flex items-center justify-start text-2xl font-semibold leading-none tabular-nums text-ui-heading";
    const scholarCardLabelClass = "flex items-center justify-start gap-1.5 text-sm font-medium leading-snug text-ui-muted";

    const firstAuthorCardActive = selectedAuthorships.includes('first-author');
    const correspondingAuthorCardActive = selectedAuthorships.includes('corresponding-author');
    const coAuthorCardActive = selectedAuthorships.includes('co-author');
    const allPublicationsCardActive = selectedAuthorships.length === 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-ui-heading`}>{config.title}</h1>
                </div>
                {!embedded && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl">
                        <button
                            type="button"
                            onClick={() => setSelectedAuthorships([])}
                            aria-pressed={allPublicationsCardActive}
                            className={getAuthorshipCardClass(allPublicationsCardActive)}
                        >
                            <div className={getAuthorshipCardNumberClass(allPublicationsCardActive)}>{publications.length}</div>
                            <div className={getAuthorshipCardLabelClass(allPublicationsCardActive)}>{messages.publications.statCards.allPublications}</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAuthorshipQuickFilter('first-author')}
                            aria-pressed={firstAuthorCardActive}
                            className={getAuthorshipCardClass(firstAuthorCardActive)}
                        >
                            <div className={getAuthorshipCardNumberClass(firstAuthorCardActive)}>{publicationStats.firstAuthor}</div>
                            <div className={getAuthorshipCardLabelClass(firstAuthorCardActive)}>{messages.publications.statCards.firstAuthor}</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAuthorshipQuickFilter('corresponding-author')}
                            aria-pressed={correspondingAuthorCardActive}
                            className={getAuthorshipCardClass(correspondingAuthorCardActive)}
                        >
                            <div className={getAuthorshipCardNumberClass(correspondingAuthorCardActive)}>{publicationStats.correspondingAuthor}</div>
                            <div className={getAuthorshipCardLabelClass(correspondingAuthorCardActive)}>{messages.publications.statCards.correspondingAuthor}</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAuthorshipQuickFilter('co-author')}
                            aria-pressed={coAuthorCardActive}
                            className={getAuthorshipCardClass(coAuthorCardActive)}
                        >
                            <div className={getAuthorshipCardNumberClass(coAuthorCardActive)}>{publicationStats.coAuthor}</div>
                            <div className={getAuthorshipCardLabelClass(coAuthorCardActive)}>{messages.publications.statCards.coAuthor}</div>
                        </button>
                        <a
                            href={googleScholarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Google Scholar ${messages.publications.statCards.citations}`}
                            className={scholarCardClass}
                        >
                            <div className={scholarCardNumberClass}>
                                {resolvedScholarMetrics ? resolvedScholarMetrics.citations.toLocaleString() : '—'}
                            </div>
                            <div className={scholarCardLabelClass}>
                                <AcademicCapIcon className="h-4 w-4" aria-hidden="true" />
                                <span>{messages.publications.statCards.citations}</span>
                            </div>
                        </a>
                        <a
                            href={googleScholarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Google Scholar ${messages.publications.statCards.hIndex}`}
                            className={scholarCardClass}
                        >
                            <div className={scholarCardNumberClass}>{resolvedScholarMetrics?.hIndex ?? '—'}</div>
                            <div className={scholarCardLabelClass}>
                                <AcademicCapIcon className="h-4 w-4" aria-hidden="true" />
                                <span>{messages.publications.statCards.hIndex}</span>
                            </div>
                        </a>
                    </div>
                )}
            </div>

            {/* Search and Filter Controls */}
            <div className="mb-8 space-y-4">
                {/* ... (keep existing controls) ... */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon
                            width={20}
                            height={20}
                            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ui-muted"
                        />
                        <input
                            type="text"
                            placeholder={messages.publications.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="frosted-surface w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                        />
                    </div>
                    <div
                        className="frosted-surface grid w-full shrink-0 grid-cols-2 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900 sm:inline-flex sm:w-auto"
                        aria-label={messages.publications.sort}
                    >
                        <button
                            onClick={() => setSortMode('year')}
                            className={cn(
                                "inline-flex min-w-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                                sortMode === 'year'
                                    ? "bg-accent text-white"
                                    : "text-ui-body hover:text-ui-accent"
                            )}
                        >
                            <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0" />
                            {messages.publications.sortByYear}
                        </button>
                        <button
                            onClick={() => setSortMode('authorship')}
                            className={cn(
                                "inline-flex min-w-0 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
                                sortMode === 'authorship'
                                    ? "bg-accent text-white"
                                    : "text-ui-body hover:text-ui-accent"
                            )}
                        >
                            <ArrowsUpDownIcon className="mr-1.5 h-4 w-4 shrink-0" />
                            {messages.publications.sortByAuthorship}
                        </button>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center justify-center px-4 py-2 rounded-lg border transition-all duration-200",
                            showFilters || hasActiveFilterSelection
                                ? "bg-accent text-white border-accent"
                                : "frosted-surface bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-ui-body hover:border-accent hover:text-ui-accent"
                        )}
                        aria-pressed={hasActiveFilterSelection}
                    >
                        <FunnelIcon className="h-5 w-5 mr-2" />
                        {messages.publications.filters}
                    </button>
                </div>

                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="frosted-surface p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap gap-6">
                                {/* Year Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-ui-body flex items-center">
                                        <CalendarIcon className="h-4 w-4 mr-1" /> {messages.publications.year}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedYears([])}
                                            aria-label={`${messages.publications.year}: ${messages.common.all}`}
                                            aria-pressed={selectedYears.length === 0}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedYears.length === 0
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                            )}
                                        >
                                            {messages.common.all}
                                        </button>
                                        {years.map(year => (
                                            <button
                                                key={year}
                                                onClick={() => setSelectedYears(current => toggleSelection(current, year))}
                                                aria-pressed={selectedYears.includes(year)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedYears.includes(year)
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                                )}
                                            >
                                                {year}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Authorship Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-ui-body flex items-center">
                                        <AcademicCapIcon className="h-4 w-4 mr-1" /> {messages.publications.type}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedAuthorships([])}
                                            aria-label={`${messages.publications.type}: ${messages.common.all}`}
                                            aria-pressed={selectedAuthorships.length === 0}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedAuthorships.length === 0
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                            )}
                                        >
                                            {messages.common.all}
                                        </button>
                                        {authorshipFilters.map(filter => (
                                            <button
                                                key={filter.value}
                                                onClick={() => setSelectedAuthorships(current => toggleSelection(current, filter.value))}
                                                aria-pressed={selectedAuthorships.includes(filter.value)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedAuthorships.includes(filter.value)
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                                )}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Journal Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-ui-body flex items-center">
                                        <BookOpenIcon className="h-4 w-4 mr-1" /> {messages.publications.journal}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedJournals([])}
                                            aria-label={`${messages.publications.journal}: ${messages.common.all}`}
                                            aria-pressed={selectedJournals.length === 0}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedJournals.length === 0
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                            )}
                                        >
                                            {messages.common.all}
                                        </button>
                                        {journals.map(journal => (
                                            <button
                                                key={journal}
                                                onClick={() => setSelectedJournals(current => toggleSelection(current, journal))}
                                                aria-pressed={selectedJournals.includes(journal)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedJournals.includes(journal)
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                                )}
                                            >
                                                {journal}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* JCR Quartile Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-ui-body flex items-center">
                                        <ChartBarIcon className="h-4 w-4 mr-1" /> {messages.publications.jcrQuartile}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedQuartiles([])}
                                            aria-label={`${messages.publications.jcrQuartile}: ${messages.common.all}`}
                                            aria-pressed={selectedQuartiles.length === 0}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedQuartiles.length === 0
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                            )}
                                        >
                                            {messages.common.all}
                                        </button>
                                        {quartiles.map(quartile => (
                                            <button
                                                key={quartile}
                                                onClick={() => setSelectedQuartiles(current => toggleSelection(current, quartile))}
                                                aria-pressed={selectedQuartiles.includes(quartile)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedQuartiles.includes(quartile)
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                                )}
                                            >
                                                {quartile}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Impact Factor Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-ui-body flex items-center">
                                        <ChartBarIcon className="h-4 w-4 mr-1" /> {messages.publications.impactFactor}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setSelectedImpactFactors([])}
                                            aria-label={`${messages.publications.impactFactor}: ${messages.common.all}`}
                                            aria-pressed={selectedImpactFactors.length === 0}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-full transition-colors",
                                                selectedImpactFactors.length === 0
                                                    ? "bg-accent text-white"
                                                    : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                            )}
                                        >
                                            {messages.common.all}
                                        </button>
                                        {impactFactorFilters.map(filter => (
                                            <button
                                                key={filter.value}
                                                onClick={() => setSelectedImpactFactors(current => toggleSelection(current, filter.value))}
                                                aria-pressed={selectedImpactFactors.includes(filter.value)}
                                                className={cn(
                                                    "px-3 py-1 text-xs rounded-full transition-colors",
                                                    selectedImpactFactors.includes(filter.value)
                                                        ? "bg-accent text-white"
                                                        : "bg-white dark:bg-white/10 text-ui-body hover:bg-neutral-100 dark:hover:bg-white/15"
                                                )}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-end">
                    <div className="frosted-surface inline-flex items-baseline gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 px-3 py-1.5 text-sm text-ui-muted">
                        <span>{messages.publications.resultCount.showing}</span>
                        <span className="font-semibold tabular-nums text-ui-heading">
                            {filteredPublications.length.toLocaleString()}
                        </span>
                        {hasNarrowedResults && (
                            <>
                                <span>{messages.publications.resultCount.of}</span>
                                <span className="font-semibold tabular-nums text-ui-heading">
                                    {publications.length.toLocaleString()}
                                </span>
                            </>
                        )}
                        <span>{visiblePublicationUnit}</span>
                    </div>
                </div>
            </div>

            {/* Publications Grid */}
            <div className="space-y-6">
                {filteredPublications.length === 0 ? (
                    <div className="text-center py-12 text-ui-muted">
                        {messages.publications.noResults}
                    </div>
                ) : (
                    filteredPublications.map((pub) => (
                        <div
                            key={pub.id}
                            className="frosted-surface bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                        >
                            <div className="flex flex-col gap-6 md:flex-row md:items-center">
                                {pub.preview && (
                                    <div className="w-full max-w-[10.2rem] mx-auto md:mx-0 md:w-[8.5rem] flex-shrink-0">
                                        <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                            <Image
                                                src={`/papers/${pub.preview}`}
                                                alt={pub.title}
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="min-w-0 flex-grow">
                                    <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold text-ui-heading mb-2 leading-tight`}>
                                        <FormattedBibTeXText nodes={pub.titleNodes} fallback={pub.title} />
                                    </h3>
                                    <p className="text-base text-ui-body mb-2">
                                        {pub.authors.map((author, idx) => (
                                            <span key={idx}>
                                                <span className={`${author.isHighlighted ? 'font-semibold text-ui-accent' : ''} ${author.isCoAuthor ? `underline underline-offset-4 ${author.isHighlighted ? 'decoration-accent' : 'decoration-neutral-400'}` : ''}`}>
                                                    {author.name}
                                                </span>
                                                {author.isCorresponding && (
                                                    <span className={`ml-0 ${author.isHighlighted ? 'text-ui-accent' : 'text-ui-body'}`}>*</span>
                                                )}
                                                {idx < pub.authors.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </p>
                                    {pub.description && (
                                        <p className="text-base leading-relaxed text-ui-body mb-4 line-clamp-3">
                                            {pub.description}
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {getPublicationVenue(pub) && (
                                            <span className={passiveTagClass}>
                                                {getPublicationVenue(pub)}
                                            </span>
                                        )}
                                        <span className={passiveTagClass}>
                                            {pub.year}
                                        </span>
                                        {pub.sci && (
                                            <span className={passiveTagClass}>
                                                {pub.sci}
                                            </span>
                                        )}
                                        {pub.sciif && (
                                            <span className={passiveTagClass}>
                                                IF:{pub.sciif}
                                            </span>
                                        )}
                                        {pub.doi && (
                                            <a
                                                href={`https://doi.org/${pub.doi}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="publication-action inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 text-ui-body hover:bg-accent hover:text-white transition-colors"
                                            >
                                                <ArrowTopRightOnSquareIcon className="h-3 w-3 mr-1.5" />
                                                DOI
                                            </a>
                                        )}
                                        {pub.abstract && (
                                            <button
                                                onClick={() => setExpandedAbstractId(expandedAbstractId === pub.id ? null : pub.id)}
                                                className={cn(
                                                    "publication-action inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors",
                                                    expandedAbstractId === pub.id
                                                        ? "bg-accent text-white"
                                                        : "bg-neutral-100 text-ui-body hover:bg-accent hover:text-white"
                                                )}
                                            >
                                                <DocumentTextIcon className="h-3 w-3 mr-1.5" />
                                                {messages.publications.abstract}
                                            </button>
                                        )}
                                        {pub.code && (
                                            <a
                                                href={pub.code}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="publication-action inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 text-ui-body hover:bg-accent hover:text-white transition-colors"
                                            >
                                                {messages.publications.code}
                                            </a>
                                        )}
                                    </div>

                                    <AnimatePresence>
                                        {expandedAbstractId === pub.id && pub.abstract ? (
                                            <motion.div
                                                key="abstract"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden mt-4"
                                            >
                                                <div className="frosted-surface-quiet bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                                                    <p className="text-base text-ui-body leading-relaxed">
                                                        {pub.abstract}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : null}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
