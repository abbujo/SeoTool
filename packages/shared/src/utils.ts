export function normalizeUrl(
    url: string,
    options: {
        stripHash?: boolean;
        stripQuery?: boolean;
        allowedQueryPatterns?: string[];
        trailingSlash?: 'always' | 'never' | 'ignore';
    } = {}
): string {
    try {
        const u = new URL(url);

        // 1. Lowercase scheme and host
        u.protocol = u.protocol.toLowerCase();
        u.hostname = u.hostname.toLowerCase();

        // 2. Remove default ports
        if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
            u.port = '';
        }

        // 3. Strip hash
        if (options.stripHash !== false) {
            u.hash = '';
        }

        // 4. Transform path - remove trailing slash if needed
        // Defaulting to "never" trailing slash for consistency if not specified
        if (options.trailingSlash === 'never' && u.pathname !== '/' && u.pathname.endsWith('/')) {
            u.pathname = u.pathname.slice(0, -1);
        } else if (options.trailingSlash === 'always' && !u.pathname.endsWith('/')) {
            u.pathname += '/';
        }

        // 5. Query params
        if (options.stripQuery === true) {
            // If allowed patterns are provided, keep only those
            if (options.allowedQueryPatterns && options.allowedQueryPatterns.length > 0) {
                const keepParams = new URLSearchParams();
                const currentParams = Array.from(u.searchParams.entries());

                for (const [key, value] of currentParams) {
                    // Simple regex match for key
                    const isAllowed = options.allowedQueryPatterns.some(pattern =>
                        new RegExp(pattern).test(key)
                    );
                    if (isAllowed) {
                        keepParams.append(key, value);
                    }
                }
                u.search = keepParams.toString();
            } else {
                u.search = '';
            }
        }

        // Sort params for consistency if any remain
        u.searchParams.sort();

        return u.toString();
    } catch (e) {
        // If invalid URL, return as is or throw. 
        // Returning original string allowing caller to handle "invalid url" logic if needed,
        // but usually better to return null or throw. 
        // For this utility, we assume input is generally a URL candidate.
        return url;
    }
}

export function generateRunId(): string {
    // Simple timestamp + random
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 7);
    return `${date}-${random}`;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
