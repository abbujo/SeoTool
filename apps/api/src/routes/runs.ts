import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { SimpleQueue } from '../queue.js';
import { RunOptions } from '@sitepulse/shared';

export async function runRoutes(fastify: FastifyInstance, options: { queue: SimpleQueue, runsDir: string }) {
    const { queue, runsDir } = options;

    // POST /runs
    fastify.post<{ Body: { baseUrl: string; options?: Partial<RunOptions> } }>('/runs', async (request, reply) => {
        const { baseUrl, options } = request.body;

        if (!baseUrl) {
            return reply.code(400).send({ error: 'baseUrl is required' });
        }

        try {
            new URL(baseUrl);
        } catch {
            return reply.code(400).send({ error: 'Invalid URL' });
        }

        const runOptions: RunOptions = {
            baseUrl,
            maxPages: options?.maxPages || 100,
            concurrency: options?.concurrency || 1,
            includePatterns: options?.includePatterns || [],
            excludePatterns: options?.excludePatterns || [],
            includeQueryPatterns: options?.includeQueryPatterns || [],
            renderJs: options?.renderJs || false,
            forceAuditNonHtml: options?.forceAuditNonHtml || false,
            distDir: options?.distDir
        };

        const runId = await queue.addRun(runOptions);
        return { runId };
    });

    // GET /runs
    fastify.get('/runs', async (request, reply) => {
        try {
            await fs.mkdir(runsDir, { recursive: true });
            const entries = await fs.readdir(runsDir, { withFileTypes: true });
            const runs = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    try {
                        const metaPath = path.join(runsDir, entry.name, 'run.meta.json');
                        const metaContent = await fs.readFile(metaPath, 'utf-8');
                        runs.push(JSON.parse(metaContent));
                    } catch (e) {
                        // ignore
                    }
                }
            }

            return runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (err) {
            return [];
        }
    });

    // GET /runs/:id
    fastify.get<{ Params: { id: string } }>('/runs/:id', async (request, reply) => {
        const { id } = request.params;

        // Check queue/memory first? Or just file. File is safest source of truth for "meta".
        try {
            const metaPath = path.join(runsDir, id, 'run.meta.json');
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            return JSON.parse(metaContent);
        } catch (e) {
            return reply.code(404).send({ error: 'Run not found' });
        }
    });

    // GET /runs/:id/summary
    fastify.get<{ Params: { id: string } }>('/runs/:id/summary', async (request, reply) => {
        const { id } = request.params;
        try {
            const summaryPath = path.join(runsDir, id, 'summary.json');
            const content = await fs.readFile(summaryPath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            return reply.code(404).send({ error: 'Summary not ready' });
        }
    });
}
