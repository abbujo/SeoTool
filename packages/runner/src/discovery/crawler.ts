import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeUrl } from '@sitepulse/shared';

export async function crawlSite(
    baseUrl: string,
    options: {
        maxPages: number;
        concurrency?: number;
        includeQueryPatterns?: string[];
    }
): Promise<string[]> {
    const visited = new Set<string>();
    const queue: string[] = [normalizeUrl(baseUrl)];
    const results = new Set<string>();
    const host = new URL(baseUrl).hostname;

    // Simple BFS
    let pagesProcessed = 0;

    while (queue.length > 0 && pagesProcessed < options.maxPages) {
        // Process in batches (concurrency)
        const batchSize = options.concurrency || 3;
        const batch = queue.splice(0, batchSize);

        await Promise.all(batch.map(async (url) => {
            if (visited.has(url)) return;
            visited.add(url);
            pagesProcessed++;

            try {
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'SitePulseBot/1.0' },
                    validateStatus: (status) => status < 400
                });

                // Only parse HTML
                const contentType = response.headers['content-type'] || '';
                if (!contentType.includes('text/html')) return;

                results.add(url);

                const $ = cheerio.load(response.data);
                $('a').each((_, element) => {
                    const href = $(element).attr('href');
                    if (!href) return;

                    try {
                        // Construct absolute URL
                        const absoluteUrl = new URL(href, url);

                        // Same origin check
                        if (absoluteUrl.hostname !== host) return;

                        // Protocol check
                        if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return;

                        // Normalize
                        const normalized = normalizeUrl(absoluteUrl.toString(), {
                            stripHash: true,
                            stripQuery: true, // simplified crawling policy
                            allowedQueryPatterns: options.includeQueryPatterns
                        });

                        if (!visited.has(normalized)) {
                            // Add to queue if unique and not visited
                            // Note: simplistic check, real visited check is at processing time
                            // but helps reduce queue duplicates
                            if (!queue.includes(normalized)) {
                                queue.push(normalized);
                            }
                        }
                    } catch (e) {
                        // invalid url
                    }
                });

            } catch (err) {
                // console.warn(`Failed to crawl ${url}:`, err);
            }
        }));
    }

    return Array.from(results);
}
