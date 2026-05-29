'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { Publication } from '@/types/publication';
import { useMessages } from '@/lib/i18n/useMessages';
import FormattedBibTeXText from '@/components/publications/FormattedBibTeXText';

interface SelectedPublicationsProps {
    publications: Publication[];
    title?: string;
    enableOnePageMode?: boolean;
}

const passiveTagClass = "inline-flex max-w-full items-center rounded-md border border-transparent bg-neutral-100 px-3 py-1 text-left text-xs font-medium leading-snug text-ui-body dark:border-white/15 dark:bg-white/15 dark:text-slate-50";

function getPublicationVenue(pub: Publication): string {
    return pub.journal || pub.conference || pub.venue || '';
}

export default function SelectedPublications({ publications, title, enableOnePageMode = false }: SelectedPublicationsProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.selectedPublications;

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-serif font-bold text-ui-heading">{resolvedTitle}</h2>
                <Link
                    href={enableOnePageMode ? "/#publications" : "/publications"}
                    prefetch={true}
                    className="text-ui-accent text-sm font-medium transition-all duration-200 rounded hover:bg-accent/10 hover:shadow-sm"
                >
                    {messages.home.viewAll} →
                </Link>
            </div>
            <div className="space-y-4">
                {publications.map((pub, index) => (
                    <motion.div
                        key={pub.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 * index }}
                        className="frosted-surface bg-white dark:bg-neutral-900 p-[1.05rem] rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
                    >
                        <div className="flex flex-col gap-6 md:flex-row md:items-center">
                            {pub.preview && (
                                <div className="w-full max-w-[6.53rem] mx-auto md:mx-0 md:w-[5.44rem] flex-shrink-0">
                                    <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                                        <Image
                                            src={`/papers/${pub.preview}`}
                                            alt={pub.title}
                                            fill
                                            className="object-contain"
                                            sizes="(max-width: 768px) 6.53rem, 5.44rem"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex-grow">
                                <h3 className="text-lg font-semibold text-ui-heading mb-2 leading-tight">
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

                                <div className="flex flex-wrap gap-2 mt-auto">
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
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
