import { FastifyInstance } from 'fastify';
import { SimpleQueue } from '../queue.js';

export async function sseRoutes(fastify: FastifyInstance, options: { queue: SimpleQueue }) {
    const { queue } = options;

    fastify.get<{ Params: { id: string } }>('/runs/:id/events', { websocket: true }, (connection, req) => {
        const { id } = req.params;
        const runner = queue.getRunner(id);

        // Handle socket being connection.socket or connection itself (compat)
        const socket = (connection as any).socket || connection;

        if (!socket) {
            fastify.log.error('WebSocket connection missing socket property');
            return;
        }

        // If runner is not active (finished or not started or rebooted), 
        // we can't emit events easily unless we replay from log?
        // For now, only support live events.
        if (!runner) {
            // Check if socket is open before sending
            if (socket.readyState === 1) { // OPEN
                socket.send(JSON.stringify({ type: 'status', data: 'completed_or_unknown' }));
            }
            // Optionally close? specific message?
            // If run is completed, client should just poll summary.

            // Let's check status from disk? 
            // If we want perfection, we'd read run.meta.json and send 'completed' if so.
            // But for "events", it implies live stream.
            return;
        }

        const onStatus = (status: string) => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: 'status', data: status }));
            }
        };

        const onProgress = (meta: any) => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: 'progress', data: meta }));
            }
        };

        const onCompleted = (meta: any) => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: 'completed', data: meta }));
                socket.close();
            }
            cleanup();
        };

        const onError = (err: any) => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: 'error', data: err.message }));
                socket.close();
            }
            cleanup();
        };

        runner.on('status', onStatus);
        runner.on('progress', onProgress);
        runner.on('completed', onCompleted);
        runner.on('error', onError);

        const cleanup = () => {
            runner.off('status', onStatus);
            runner.off('progress', onProgress);
            runner.off('completed', onCompleted);
            runner.off('error', onError);
        };

        socket.on('close', cleanup);
    });
}
