import fs from 'fs';
import path from 'path';

/**
 * Resolves the directory containing static data JSON files (metadata maps, sitemap data, etc.)
 * safely across development, standard production, and Next.js standalone container environments.
 */
export function getServerDataDir(): string {
    const candidates = [
        path.join(process.cwd(), 'public', 'data'),
        path.join(process.cwd(), 'web', 'public', 'data'),
        path.join(process.cwd(), 'nextjs', 'web', 'public', 'data'),
        '/app/nextjs/web/public/data',
        '/app/public/data',
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}
