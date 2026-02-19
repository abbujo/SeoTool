import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { AuditScores } from '@sitepulse/shared';

export interface LighthouseResult {
    scores: AuditScores;
    reportJson: string;
    reportHtml: string;
}

export async function runLighthouse(
    url: string,
    options: {
        formFactor: 'mobile' | 'desktop';
        port?: number;
    }
): Promise<LighthouseResult> {
    const chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });

    const flags = {
        logLevel: 'error' as const,
        output: ['json', 'html'] as any,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: chrome.port,
        formFactor: options.formFactor,
        screenEmulation: options.formFactor === 'mobile' ? undefined : {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
        },
    };

    const config = options.formFactor === 'desktop' ? {
        extends: 'lighthouse:default',
        settings: {
            formFactor: 'desktop' as const,
            screenEmulation: {
                mobile: false,
                width: 1350,
                height: 940,
                deviceScaleFactor: 1,
                disabled: false,
            },
        }
    } : undefined;

    const runnerResult = await lighthouse(url, flags, config);
    if (!runnerResult) {
        await chrome.kill();
        throw new Error('Lighthouse failed to produce a result');
    }

    const report = runnerResult.report;
    const reportJson = Array.isArray(report) ? report[0] : report;
    const reportHtml = Array.isArray(report) ? report[1] || report[0] : report;
    const lhr = runnerResult.lhr;

    await chrome.kill();

    return {
        scores: {
            performance: lhr.categories.performance?.score || 0,
            accessibility: lhr.categories.accessibility?.score || 0,
            bestPractices: lhr.categories['best-practices']?.score || 0,
            seo: lhr.categories.seo?.score || 0,
        },
        reportJson,
        reportHtml
    };
}
