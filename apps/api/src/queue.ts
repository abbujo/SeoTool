import { AuditRunner } from '@sitepulse/runner';
import { RunOptions, RunMeta } from '@sitepulse/shared';
import * as path from 'path';
import * as fs from 'fs/promises';

interface Job {
    runId: string;
    runner: AuditRunner;
    options: RunOptions;
}

export class JobQueue {
    private jobs: Map<string, Job> = new Map();
    private activeJobs: number = 0;
    private maxConcurrentJobs: number = 2;
    private runsDir: string;

    constructor(runsDir: string) {
        this.runsDir = runsDir;
    }

    async addJob(options: RunOptions): Promise<string> {
        const runner = new AuditRunner(options, this.runsDir);
        const runId = runner.getRunId();

        this.jobs.set(runId, {
            runId,
            runner,
            options
        });

        // Start processing
        this.processQueue();

        return runId;
    }

    getJob(runId: string): Job | undefined {
        return this.jobs.get(runId);
    }

    // Simple in-memory queue processing with concurrency limit
    private async processQueue() {
        if (this.activeJobs >= this.maxConcurrentJobs) return;

        for (const [runId, job] of this.jobs) {
            if (this.activeJobs >= this.maxConcurrentJobs) break;

            // Check if already running or completed (via meta file check or in-memory status)
            // For this simple queue, we rely on in-memory status not explicitly tracked in Job struct yet.
            // We need to know if it's 'pending'.
            // Let's assume if it's in `jobs` map but not "active", it might need running.
            // Actually, let's track status in Job object or remove from queue when done.

            // Better approach:
            // 1. Maintain a separate 'pending' queue.
            // 2. Or check runner status? Runner status is initialized.
        }

        // Revised simple approach:
        // Just find first initializing job
        // This is O(N) but N is small.

        // We need to access runner status synchronously or async. 
        // Runner status is in memory.
    }

    // Let's rewrite processQueue to be cleaner with a pending list
}

// Re-implementing with a cleaner queue array
export class SimpleQueue {
    private queue: Job[] = [];
    private active: Map<string, Job> = new Map();
    private completed: Map<string, Job> = new Map(); // Optional: keep reference
    private maxConcurrent: number = 2;
    private runsDir: string;

    constructor(runsDir: string) {
        this.runsDir = runsDir;
    }

    async addRun(options: RunOptions): Promise<string> {
        const runner = new AuditRunner(options, this.runsDir);
        const job: Job = { runId: runner.getRunId(), runner, options };

        // Initialize the runner (writes meta to disk)
        // We can't await start() here, but we should await meta creation?
        // Runner constructor init is sync but it doesn't write to disk until start().
        // We want the user to get ID immediately.

        this.queue.push(job);
        setImmediate(() => this.process());
        return job.runId;
    }

    getRunner(runId: string): AuditRunner | undefined {
        // Check active
        if (this.active.has(runId)) return this.active.get(runId)?.runner;
        // Check queue
        const queued = this.queue.find(j => j.runId === runId);
        if (queued) return queued.runner;
        // Check completed memory
        if (this.completed.has(runId)) return this.completed.get(runId)?.runner;

        return undefined;
    }

    private async process() {
        if (this.active.size >= this.maxConcurrent) return;

        const job = this.queue.shift();
        if (!job) return;

        this.active.set(job.runId, job);

        // Run in background
        job.runner.start().then(() => {
            this.active.delete(job.runId);
            this.completed.set(job.runId, job);
            this.process();
        }).catch(err => {
            console.error(`Job ${job.runId} failed:`, err);
            this.active.delete(job.runId);
            this.completed.set(job.runId, job);
            this.process();
        });
    }
}
