import React, { useEffect, useState } from 'react';
import type { RunMeta } from '@sitepulse/shared';

interface Props {
    apiUrl: string;
}

export default function RunHistory({ apiUrl }: Props) {
    const [runs, setRuns] = useState<RunMeta[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${apiUrl}/runs`)
            .then(res => res.json())
            .then(data => {
                setRuns(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [apiUrl]);

    if (loading) return <div>Loading runs...</div>;

    if (runs.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-10 text-center">
                <p className="text-gray-500">No runs found.</p>
                <a href="/" className="mt-4 inline-block px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                    Start New Audit
                </a>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {runs.map((run) => (
                <a href={`/run?id=${run.id}`} className="block group" key={run.id}>
                    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer border-l-4`}
                        style={{ borderLeftColor: run.status === 'completed' ? '#10B981' : run.status === 'failed' ? '#EF4444' : '#3B82F6' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600">
                                    {run.baseUrl}
                                </h3>
                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                    <span>ID: {run.id}</span>
                                    <span>&bull;</span>
                                    <span>{new Date(run.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                    run.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    run.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                    {run.status}
                                </span>
                                <div className="mt-2 text-sm text-gray-500">
                                    {run.stats.totalCompleted} / {run.stats.totalDiscovered} Pages
                                </div>
                            </div>
                        </div>
                    </div>
                </a>
            ))}
        </div>
    );
}
