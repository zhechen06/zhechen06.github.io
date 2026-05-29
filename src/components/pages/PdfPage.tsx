'use client';

import { motion } from 'framer-motion';
import { PdfPageConfig } from '@/types/page';

export default function PdfPage({ config, embedded = false }: { config: PdfPageConfig; embedded?: boolean }) {
    const showHeader = !config.hide_title && Boolean(config.title || config.description);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
        >
            {showHeader && (
                <div>
                    {config.title && (
                        <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-ui-heading mb-4`}>{config.title}</h1>
                    )}
                    {config.description && (
                        <p className={`${embedded ? "text-base" : "text-lg"} text-ui-muted max-w-2xl leading-relaxed`}>
                            {config.description}
                        </p>
                    )}
                </div>
            )}

            <div className="mx-auto aspect-[210/289] w-[84%] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <object
                    data={`${config.source}#toolbar=1&navpanes=0`}
                    type="application/pdf"
                    className="h-full w-full"
                    aria-label={config.title}
                >
                    <iframe
                        src={`${config.source}#toolbar=1&navpanes=0`}
                        title={config.title}
                        className="h-full w-full"
                    />
                </object>
            </div>
        </motion.div>
    );
}
