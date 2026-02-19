import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import websocket from '@fastify/websocket';
import path from 'path';
import { SimpleQueue } from './queue.js';
import { runRoutes } from './routes/runs.js';
import { sseRoutes } from './routes/sse.js';

const fastify = Fastify({
    logger: true
});

const RUNS_DIR = path.join(process.cwd(), 'runs');
// Ensure RUNS_DIR exists
import fs from 'fs';
if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR);

const queue = new SimpleQueue(RUNS_DIR);

const start = async () => {
    try {
        await fastify.register(cors, {
            origin: true
        });

        await fastify.register(websocket);

        await fastify.register(staticPlugin, {
            root: RUNS_DIR,
            prefix: '/runs/',
            decorateReply: false
        });

        await fastify.register(runRoutes, { queue, runsDir: RUNS_DIR });
        await fastify.register(sseRoutes, { queue });

        const port = parseInt(process.env.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port} (v3 - post-rebuild)`);
        console.log(`Runs directory: ${RUNS_DIR}`);

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
