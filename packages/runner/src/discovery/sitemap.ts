import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import robotsParser from 'robots-parser';
import { normalizeUrl } from '@sitepulse/shared';

const MAX_SITEMAP_LINKS = 50000;

export async function discoverFromSitemaps(baseUrl: string): Promise<string[]> {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const urls = new Set<string>();

    try {
        // 1. Fetch robots.txt
        const robotsResponse = await axios.get(robotsUrl, { timeout: 10000, validateStatus: () => true });
        let sitemapUrls: string[] = [];

        if (robotsResponse.status === 200) {
            const robots = (robotsParser as any)(robotsUrl, robotsResponse.data);
            sitemapUrls = robots.getSitemaps();
        }

        // 2. Fallback sitemaps if none in robots.txt
        if (sitemapUrls.length === 0) {
            const commonSitemaps = [
                '/sitemap.xml',
                '/sitemap_index.xml',
                '/wp-sitemap.xml'
            ];
            for (const path of commonSitemaps) {
                sitemapUrls.push(new URL(path, baseUrl).toString());
            }
        }

        // 3. Process sitemaps (handling index files)
        const processedSitemaps = new Set<string>();
        const queue = [...sitemapUrls];

        while (queue.length > 0) {
            const sitemapUrl = queue.shift()!;
            if (processedSitemaps.has(sitemapUrl)) continue;
            processedSitemaps.add(sitemapUrl);

            try {
                const response = await axios.get(sitemapUrl, { timeout: 15000, validateStatus: () => true });
                if (response.status !== 200) continue;

                const parser = new XMLParser({ ignoreAttributes: false });
                const data = parser.parse(response.data);

                // Handle Sitemap Index
                if (data.sitemapindex && data.sitemapindex.sitemap) {
                    const sitemaps = Array.isArray(data.sitemapindex.sitemap)
                        ? data.sitemapindex.sitemap
                        : [data.sitemapindex.sitemap];

                    for (const s of sitemaps) {
                        if (s.loc) queue.push(s.loc);
                    }
                }
                // Handle Urlset
                else if (data.urlset && data.urlset.url) {
                    const urlEntries = Array.isArray(data.urlset.url)
                        ? data.urlset.url
                        : [data.urlset.url];

                    for (const entry of urlEntries) {
                        if (entry.loc && typeof entry.loc === 'string') {
                            urls.add(normalizeUrl(entry.loc));
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to process sitemap ${sitemapUrl}:`, err);
            }

            if (urls.size >= MAX_SITEMAP_LINKS) break;
        }

    } catch (error) {
        console.warn('Error in sitemap discovery:', error);
    }

    return Array.from(urls);
}
