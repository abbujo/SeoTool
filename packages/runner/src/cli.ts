#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { AuditRunner } from './index.js';

const program = new Command();

program
    .name('sitepulse')
    .description('SitePulse CLI - SEO & Accessibility Auditor')
    .version('0.0.1');

program
    .command('audit')
    .description('Run a full audit on a URL')
    .requiredOption('--baseUrl <url>', 'Base URL to audit')
    .option('--runsDir <dir>', 'Directory to save runs', './runs')
    .option('--concurrency <number>', 'Concurrency limit', '1')
    .option('--maxPages <number>', 'Max pages to discovery', '100')
    .action(async (options) => {
        console.log(`Starting audit for ${options.baseUrl}...`);

        const runner = new AuditRunner({
            baseUrl: options.baseUrl,
            maxPages: parseInt(options.maxPages),
            concurrency: parseInt(options.concurrency),
            includePatterns: [],
            excludePatterns: [],
            includeQueryPatterns: [],
            renderJs: false,
            forceAuditNonHtml: false
        }, path.resolve(options.runsDir));

        runner.on('status', (status) => console.log(`Status: ${status}`));
        runner.on('progress', (meta) => {
            console.log(`Progress: ${meta.stats.totalCompleted} completed, ${meta.stats.totalFailed} failed`);
        });

        await runner.start();
        console.log(`Audit completed. Run ID: ${runner.getRunId()}`);
    });

program
    .command('scan-dist')
    .description('Scan a dist folder and output routes')
    .requiredOption('--dist <dir>', 'Dist directory path')
    .requiredOption('--baseUrl <url>', 'Base URL for routes')
    .action(async (options) => {
        try {
            const { scanDistFolder } = await import('./discovery/dist-scan.js');
            const fs = await import('fs/promises');

            console.log(`Scanning dist folder: ${options.dist}`);
            const urls = await scanDistFolder(options.dist, options.baseUrl);

            console.log(`Found ${urls.length} pages.`);

            await fs.writeFile('routes.json', JSON.stringify(urls, null, 2));
            console.log('Saved routes to routes.json');

        } catch (err: any) {
            console.error('Error scanning dist:', err.message);
            process.exit(1);
        }
    });

program.parse();
