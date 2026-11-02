'use client';

import { useEffect, useState } from 'react';
import type { ScholarMetrics } from '@/types/page';

const googleScholarStatsUrl =
    'https://cdn.jsdelivr.net/gh/zhechen06/zhechen06.github.io@google-scholar-stats/gs_data.json';

export function useGoogleScholarMetrics(profileUrl?: string, enabled = true): ScholarMetrics | null {
    const [metrics, setMetrics] = useState<ScholarMetrics | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let isMounted = true;
        const cacheKey = new Date().toISOString().slice(0, 13);

        fetch(`${googleScholarStatsUrl}?v=${cacheKey}`)
            .then((response) => {
                if (!response.ok) throw new Error(`Google Scholar stats returned HTTP ${response.status}`);
                return response.json() as Promise<{ citedby?: number; hindex?: number; updated?: string }>;
            })
            .then((stats) => {
                if (!isMounted ||
                    typeof stats.citedby !== 'number' || !Number.isFinite(stats.citedby) ||
                    typeof stats.hindex !== 'number' || !Number.isInteger(stats.hindex) || stats.hindex < 0) {
                    return;
                }

                setMetrics({
                    citations: stats.citedby,
                    hIndex: stats.hindex,
                    sourceUrl: profileUrl,
                    fetchedAt: stats.updated,
                });
            })
            .catch(() => {
                // Leave the caller's fallback in place when live stats are unavailable.
            });

        return () => { isMounted = false; };
    }, [profileUrl, enabled]);

    return metrics;
}
