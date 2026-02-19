import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    RunOptions,
    RunMeta,
    PageAuditResult,
    generateRunId,
    normalizeUrl,
    DiscoverySource
} from '@sitepulse/shared';
import { discoverFromSitemaps } from './discovery/sitemap.js';
import { crawlSite } from './discovery/crawler.js';
import { scanDistFolder } from './discovery/dist-scan.js';
import { runLighthouse } from './lighthouse.js';
import pLimit from 'p-limit';

export class AuditRunner extends EventEmitter {
    private runId: string;
    private options: RunOptions;
    private runsDir: string;
    private runDir: string;
    private meta: RunMeta;
    private pages: Map<string, PageAuditResult> = new Map();

    constructor(options: RunOptions, runsDir: string) {
        super();
        this.options = options;
        this.runsDir = runsDir;
        this.runId = generateRunId();
        this.runDir = path.join(runsDir, this.runId);

        this.meta = {
            id: this.runId,
            baseUrl: options.baseUrl,
            status: 'initializing',
            createdAt: new Date().toISOString(),
            options: options,
            stats: {
                totalDiscovered: 0,
                totalqueued: 0,
                totalCompleted: 0,
                totalFailed: 0,
                avgMobileScores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
                avgDesktopScores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }
            }
        };
    }

    async start() {
        try {
            await fs.mkdir(this.runDir, { recursive: true });
            await this.saveMeta();

            // 1. Discovery
            this.updateStatus('discovering');
            const discoveredUrls = new Set<string>();

            // A. Sitemap
            if (!this.options.distDir) {
                const sitemapUrls = await discoverFromSitemaps(this.options.baseUrl);
                sitemapUrls.forEach(u => this.registerUrl(u, 'sitemap'));
            }

            // B. Crawl
            if (!this.options.distDir) {
                const crawlUrls = await crawlSite(this.options.baseUrl, {
                    maxPages: this.options.maxPages,
                    concurrency: this.options.concurrency,
                    includeQueryPatterns: this.options.includeQueryPatterns
                });
                crawlUrls.forEach(u => this.registerUrl(u, 'crawl'));
            }

            // C. Dist Scan
            if (this.options.distDir) {
                const distUrls = await scanDistFolder(this.options.distDir, this.options.baseUrl);
                distUrls.forEach(u => this.registerUrl(u, 'dist'));
            }

            // 2. Auditing
            this.updateStatus('auditing');
            const limit = pLimit(this.options.concurrency || 1);

            const tasks = Array.from(this.pages.values()).map(page => {
                return limit(() => this.auditPage(page));
            });

            await Promise.all(tasks);

            // 3. Compile
            this.meta.completedAt = new Date().toISOString();
            this.meta.status = 'completed';
            await this.saveMeta();
            await this.saveSummary();

            this.emit('completed', this.meta);

        } catch (err: any) {
            this.meta.status = 'failed';
            this.meta.error = err.message;
            await this.saveMeta();
            this.emit('error', err);
        }
    }

    private registerUrl(url: string, source: DiscoverySource) {
        if (this.pages.has(url)) return;

        // Check patterns
        // TODO: Implement include/exclude pattern matching logic here

        this.pages.set(url, {
            url,
            status: 'skipped', // default until queued
            discoveredFrom: source
        });
        this.meta.stats.totalDiscovered++;
    }

    private totalMobileScores = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    private totalDesktopScores = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };

    private async auditPage(page: PageAuditResult) {
        page.status = 'skipped'; // Placeholder for "running" status if we want granular updates

        try {
            // Save stable folder name
            const urlObj = new URL(page.url);
            const folderHash = Math.random().toString(36).substring(2, 7);
            const folderName = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_') + '_' + folderHash;
            const reportDir = path.join(this.runDir, 'reports', folderName);
            await fs.mkdir(reportDir, { recursive: true });

            // Mobile
            const mobileResult = await runLighthouse(page.url, { formFactor: 'mobile' });
            await fs.writeFile(path.join(reportDir, 'mobile.json'), mobileResult.reportJson);
            await fs.writeFile(path.join(reportDir, 'mobile.html'), mobileResult.reportHtml);

            page.mobile = {
                scores: mobileResult.scores,
                reportPath: `reports/${folderName}/mobile.json`,
                htmlPath: `reports/${folderName}/mobile.html`
            };

            this.totalMobileScores.performance += mobileResult.scores.performance;
            this.totalMobileScores.accessibility += mobileResult.scores.accessibility;
            this.totalMobileScores.bestPractices += mobileResult.scores.bestPractices;
            this.totalMobileScores.seo += mobileResult.scores.seo;

            // Desktop
            const desktopResult = await runLighthouse(page.url, { formFactor: 'desktop' });
            await fs.writeFile(path.join(reportDir, 'desktop.json'), desktopResult.reportJson);
            await fs.writeFile(path.join(reportDir, 'desktop.html'), desktopResult.reportHtml);

            page.desktop = {
                scores: desktopResult.scores,
                reportPath: `reports/${folderName}/desktop.json`,
                htmlPath: `reports/${folderName}/desktop.html`
            };

            this.totalDesktopScores.performance += desktopResult.scores.performance;
            this.totalDesktopScores.accessibility += desktopResult.scores.accessibility;
            this.totalDesktopScores.bestPractices += desktopResult.scores.bestPractices;
            this.totalDesktopScores.seo += desktopResult.scores.seo;

            page.status = 'up';
            this.meta.stats.totalCompleted++;

            // Update averages
            const count = this.meta.stats.totalCompleted;
            this.meta.stats.avgMobileScores = {
                performance: this.totalMobileScores.performance / count,
                accessibility: this.totalMobileScores.accessibility / count,
                bestPractices: this.totalMobileScores.bestPractices / count,
                seo: this.totalMobileScores.seo / count
            };
            this.meta.stats.avgDesktopScores = {
                performance: this.totalDesktopScores.performance / count,
                accessibility: this.totalDesktopScores.accessibility / count,
                bestPractices: this.totalDesktopScores.bestPractices / count,
                seo: this.totalDesktopScores.seo / count
            };

            this.emit('progress', this.meta);

        } catch (err: any) {
            page.status = 'error';
            page.error = err.message;
            this.meta.stats.totalFailed++;
        }
    }

    private updateStatus(status: RunMeta['status']) {
        this.meta.status = status;
        this.emit('status', status);
    }

    private async saveMeta() {
        await fs.writeFile(
            path.join(this.runDir, 'run.meta.json'),
            JSON.stringify(this.meta, null, 2)
        );
    }

    private async saveSummary() {
        const summary = {
            ...this.meta,
            pages: Array.from(this.pages.values())
        };
        await fs.writeFile(
            path.join(this.runDir, 'summary.json'),
            JSON.stringify(summary, null, 2)
        );
    }

    getRunId() {
        return this.runId;
    }
}
