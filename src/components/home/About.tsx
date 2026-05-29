'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { useMessages } from '@/lib/i18n/useMessages';

interface AboutProps {
    content: string;
    title?: string;
    showTitle?: boolean;
}

export default function About({ content, title, showTitle = true }: AboutProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.about;

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
        >
            {showTitle && (
                <h2 className="text-2xl font-serif font-bold text-ui-heading mb-4">{resolvedTitle}</h2>
            )}
            <div className="text-ui-body leading-relaxed">
                <ReactMarkdown
                    components={{
                        h1: ({ children }) => <h1 className="text-3xl font-serif font-bold text-ui-heading mt-8 mb-4">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-2xl font-serif font-bold text-ui-heading mt-8 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xl font-semibold text-ui-heading mt-6 mb-3">{children}</h3>,
                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1 ml-4">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1 ml-4">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        a: ({ node, ...props }) => {
                            void node;
                            return (
                                <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-ui-accent font-medium transition-all duration-200 rounded hover:bg-accent/10 hover:shadow-sm"
                                />
                            );
                        },
                        img: ({ node, src, alt }) => {
                            void node;
                            const imageSrc = typeof src === 'string' ? src : '';

                            return (
                                <Image
                                    src={imageSrc}
                                    alt={alt || ''}
                                    width={112}
                                    height={20}
                                    unoptimized
                                    className="ml-1 inline-block h-5 w-auto align-[-0.2rem]"
                                />
                            );
                        },
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-accent/50 pl-4 italic my-4 text-ui-muted">
                                {children}
                            </blockquote>
                        ),
                        strong: ({ children }) => <strong className="font-semibold text-ui-heading">{children}</strong>,
                        em: ({ children }) => <em className="italic text-ui-muted">{children}</em>,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </motion.section>
    );
}
