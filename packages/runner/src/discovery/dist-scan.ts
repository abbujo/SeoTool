import fs from 'fs/promises';
import path from 'path';
import { normalizeUrl } from '@sitepulse/shared';

export async function scanDistFolder(
    distDir: string,
    baseUrl: string
): Promise<string[]> {
    const urls: string[] = [];

    async function scan(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                // Calculate relative path from dist root
                let relPath = path.relative(distDir, fullPath);

                // Normalize to URL path
                // Windows backslashes to forward slashes
                relPath = relPath.split(path.sep).join('/');

                // Remove index.html
                if (relPath.endsWith('index.html')) {
                    relPath = relPath.replace('index.html', '');
                } else {
                    relPath = relPath.replace('.html', '');
                }

                // Construct URL
                const url = new URL(relPath, baseUrl).toString();
                urls.push(normalizeUrl(url));
            }
        }
    }

    try {
        await scan(distDir);
    } catch (err) {
        console.error(`Error scanning dist folder ${distDir}:`, err);
        throw err;
    }

    return urls;
}
