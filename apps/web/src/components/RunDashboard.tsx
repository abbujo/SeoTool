import React, { useEffect, useState } from 'react';
import type { RunMeta, PageAuditResult } from '@sitepulse/shared';

interface Props {
  runId?: string; // Optional now
  apiUrl: string;
}

export default function RunDashboard({ runId: propRunId, apiUrl }: Props) {
  const [runId, setRunId] = useState<string | null>(propRunId || null);
  const [status, setStatus] = useState<string>('initializing');
  const [stats, setStats] = useState<RunMeta['stats'] | null>(null);
  const [pages, setPages] = useState<PageAuditResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no prop, try URL param
    if (!runId && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) setRunId(id);
        else setError("No Run ID provided");
    }
  }, []);

  useEffect(() => {
    if (!runId) return;

    // Initial fetch
    fetch(`${apiUrl}/runs/${runId}/summary`)
        .then(res => {
            if(res.ok) return res.json();
            return fetch(`${apiUrl}/runs/${runId}`).then(r => r.json());
        })
        .then(data => {
            if(data.pages) setPages(data.pages);
            setStats(data.stats);
            setStatus(data.status);
            console.log("RunDashboard fetched stats:", data.stats);
        })
        .catch(err => console.error("Initial fetch failed", err));

    // SSE
    const es = new WebSocket(`ws://localhost:3000/runs/${runId}/events`);
    
    es.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') setStatus(msg.data);
            if (msg.type === 'progress') {
                const meta = msg.data as RunMeta;
                setStats(meta.stats);
                setStatus(meta.status);
            }
            if (msg.type === 'completed') {
                setStatus('completed');
                setStats(msg.data.stats);
                fetch(`${apiUrl}/runs/${runId}/summary`)
                    .then(res => res.json())
                    .then(data => {
                        setPages(data.pages);
                    });
            }
            if (msg.type === 'error') setError(msg.data);
        } catch(e) {}
    };

    return () => es.close();
  }, [runId, apiUrl]);

  if (!runId) {
      return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
        {/* Status Header */}
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Run ID: <span className="font-mono text-base font-normal">{runId}</span></h2>
                    <h3 className="text-lg font-medium mt-1">Status: <span className="uppercase text-blue-600">{status}</span></h3>
                    {error && <p className="text-red-500 mt-2">{error}</p>}
                </div>
                {/* Stats */}
                <div className="flex space-x-8 text-center">
                    <div>
                        <span className="block text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalDiscovered || 0}</span>
                        <span className="text-sm text-gray-500">Discovered</span>
                    </div>
                    <div>
                        <span className="block text-2xl font-bold text-green-600">{stats?.totalCompleted || 0}</span>
                        <span className="text-sm text-gray-500">Completed</span>
                    </div>
                    <div>
                        <span className="block text-2xl font-bold text-red-600">{stats?.totalFailed || 0}</span>
                        <span className="text-sm text-gray-500">Failed</span>
                    </div>
                </div>
            </div>
            
            {/* Progress Bar */}
            {(status === 'discovering' || status === 'auditing') && (
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${stats && stats.totalDiscovered > 0 ? (stats.totalCompleted / stats.totalDiscovered) * 100 : 0}%` }}></div>
                </div>
            )}
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScoreCard title="Mobile Scores" scores={stats?.avgMobileScores} />
            <ScoreCard title="Desktop Scores" scores={stats?.avgDesktopScores} />
        </div>

        {/* Pages Table */}
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-medium">Pages ({pages.length})</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700">URL</th>
                            <th rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700">Status</th>
                            <th colSpan={5} className="px-6 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 dark:border-gray-700">Mobile Report</th>
                            <th colSpan={5} className="px-6 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Desktop Report</th>
                        </tr>
                        <tr>
                            {/* Mobile Sub-headers */}
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">Perf</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">SEO</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">A11y</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">BP</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider border-r border-gray-200 dark:border-gray-700">Link</th>

                            {/* Desktop Sub-headers */}
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">Perf</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">SEO</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">A11y</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">BP</th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 tracking-wider">Link</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {pages.map((page) => (
                            <tr key={page.url} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white max-w-xs overflow-hidden text-ellipsis border-r border-gray-200 dark:border-gray-700" title={page.url}>
                                    {new URL(page.url).pathname}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200 dark:border-gray-700">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        page.status === 'up' ? 'bg-green-100 text-green-800' : 
                                        page.status === 'down' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {page.status}
                                    </span>
                                </td>

                                {/* Mobile Data */}
                                <ScoreCell value={page.mobile?.scores.performance} />
                                <ScoreCell value={page.mobile?.scores.seo} />
                                <ScoreCell value={page.mobile?.scores.accessibility} />
                                <ScoreCell value={page.mobile?.scores.bestPractices} />
                                <td className="px-2 py-4 whitespace-nowrap text-sm text-center border-r border-gray-200 dark:border-gray-700">
                                    {page.mobile ? (
                                        <a href={`${apiUrl}/runs/${runId}/${page.mobile.htmlPath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                    ) : '-'}
                                </td>

                                {/* Desktop Data */}
                                <ScoreCell value={page.desktop?.scores.performance} />
                                <ScoreCell value={page.desktop?.scores.seo} />
                                <ScoreCell value={page.desktop?.scores.accessibility} />
                                <ScoreCell value={page.desktop?.scores.bestPractices} />
                                <td className="px-2 py-4 whitespace-nowrap text-sm text-center">
                                    {page.desktop ? (
                                        <a href={`${apiUrl}/runs/${runId}/${page.desktop.htmlPath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}

function ScoreCard({ title, scores }: { title: string, scores: any }) {
    if (!scores) return null;
    return (
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
            <h3 className="font-medium mb-4">{title}</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
                <ScoreItem label="Perf" value={scores.performance * 100} />
                <ScoreItem label="SEO" value={scores.seo * 100} />
                <ScoreItem label="A11y" value={scores.accessibility * 100} />
                <ScoreItem label="BP" value={scores.bestPractices * 100} />
            </div>
        </div>
    );
}

function ScoreItem({ label, value }: { label: string, value: number }) {
    const color = value >= 90 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600';
    return (
        <div className="flex flex-col">
            <span className={`text-2xl font-bold ${color}`}>{Math.round(value)}</span>
            <span className="text-xs text-gray-500">{label}</span>
        </div>
    );
}

function ScoreCell({ value }: { value?: number }) {
    if (value === undefined) return <td className="px-2 py-4 whitespace-nowrap text-sm text-center text-gray-300">-</td>;
    const score = Math.round(value * 100);
    const color = score >= 90 ? 'text-green-600 font-bold' : score >= 50 ? 'text-yellow-600 font-medium' : 'text-red-600';
    return <td className={`px-2 py-4 whitespace-nowrap text-sm text-center ${color}`}>{score}</td>;
}
