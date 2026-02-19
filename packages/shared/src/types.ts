export type DiscoverySource = 'sitemap' | 'crawl' | 'dist' | 'manual';

export interface AuditScores {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
}

export interface PageAuditResult {
    url: string;
    finalUrl?: string; // after redirects
    status: 'up' | 'down' | 'skipped' | 'error';
    statusCode?: number;
    error?: string;
    responseTimeMs?: number;
    discoveredFrom: DiscoverySource;

    mobile?: {
        scores: AuditScores;
        reportPath: string; // relative to run dir
        htmlPath: string;
    };
    desktop?: {
        scores: AuditScores;
        reportPath: string; // relative to run dir
        htmlPath: string;
    };
}

export interface RunStats {
    totalDiscovered: number;
    totalqueued: number;
    totalCompleted: number;
    totalFailed: number;
    avgMobileScores: AuditScores;
    avgDesktopScores: AuditScores;
}

export interface RunOptions {
    baseUrl: string;
    maxPages: number;
    concurrency: number;
    includePatterns: string[];
    excludePatterns: string[];
    includeQueryPatterns: string[];
    renderJs: boolean;
    forceAuditNonHtml: boolean;
    distDir?: string; // for dist scan mode
}

export interface RunMeta {
    id: string;
    baseUrl: string;
    status: 'initializing' | 'discovering' | 'auditing' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    options: RunOptions;
    stats: RunStats;
    error?: string;
}

export type RunSummary = RunMeta & {
    pages: PageAuditResult[];
};
