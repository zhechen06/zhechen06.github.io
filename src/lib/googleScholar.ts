import https from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ScholarMetrics } from '@/types/page';

export const GOOGLE_SCHOLAR_STATS_URL =
  'https://cdn.jsdelivr.net/gh/zhechen06/zhechen06.github.io@google-scholar-stats/gs_data.json';

const metricsCache = new Map<string, Promise<ScholarMetrics | null>>();

function fetchHtml(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      },
      (response) => {
        const location = response.headers.location;

        if (
          location &&
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          redirects < 3
        ) {
          response.resume();
          resolve(fetchHtml(new URL(location, url).toString(), redirects + 1));
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          response.resume();
          reject(new Error(`Google Scholar responded with HTTP ${response.statusCode ?? 'unknown'}`));
          return;
        }

        let html = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          html += chunk;
        });
        response.on('end', () => resolve(html));
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Google Scholar request timed out'));
    });
    request.on('error', reject);
  });
}

function parseScholarMetrics(rawStats: string, profileUrl: string): ScholarMetrics {
  const stats = JSON.parse(rawStats) as { citedby?: number; hindex?: number; updated?: string };

  if (typeof stats.citedby === 'number' && typeof stats.hindex === 'number') {
    return {
      citations: stats.citedby,
      hIndex: stats.hindex,
      sourceUrl: profileUrl,
      fetchedAt: stats.updated || new Date().toISOString(),
    };
  }

  throw new Error('Unable to parse Google Scholar stats');
}

async function fetchGoogleScholarMetrics(profileUrl: string): Promise<ScholarMetrics | null> {
  try {
    const localStatsPath = path.join(process.cwd(), 'google-scholar-stats', 'gs_data.json');
    const rawStats = await readFile(localStatsPath, 'utf8');
    return parseScholarMetrics(rawStats, profileUrl);
  } catch {
    try {
      const rawStats = await fetchHtml(GOOGLE_SCHOLAR_STATS_URL);
      return parseScholarMetrics(rawStats, profileUrl);
    } catch (statsError) {
      console.warn(
        `[google-scholar] Unable to load generated metrics: ${
          statsError instanceof Error ? statsError.message : String(statsError)
        }`
      );
      return null;
    }
  }
}

export function getGoogleScholarMetrics(profileUrl?: string): Promise<ScholarMetrics | null> {
  if (!profileUrl) {
    return Promise.resolve(null);
  }

  if (!metricsCache.has(profileUrl)) {
    metricsCache.set(profileUrl, fetchGoogleScholarMetrics(profileUrl));
  }

  return metricsCache.get(profileUrl)!;
}
