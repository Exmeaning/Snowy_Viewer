/**
 * Guides data fetching utilities
 * Fetches guide index and markdown content from moe.exmeaning.com
 */

const GUIDES_INDEX_URL = "https://moe.exmeaning.com/guides/guides-index.json";
const GUIDES_BASE_URL = "https://moe.exmeaning.com/guides";

export interface GuideAuthor {
    group: string;
    supervisor: string;
    writer?: string;
    producer?: string;
}

export interface GuideEntry {
    id: string;
    title: string;
    category: string;
    tags: string[];
    date: string;
    path: string;
    source?: string;
    xiumi_show_id?: number;
    author: GuideAuthor;
}

export interface GuidesIndex {
    version: string;
    generated_at: string;
    categories: Record<string, string>;
    guides: GuideEntry[];
}

/**
 * Fetch the guides index JSON
 */
export async function fetchGuidesIndex(): Promise<GuidesIndex> {
    const response = await fetch(GUIDES_INDEX_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch guides index: HTTP ${response.status}`);
    }
    return response.json();
}

/**
 * Fetch a guide's markdown content by its path
 */
export async function fetchGuideContent(path: string): Promise<string> {
    const url = `${GUIDES_BASE_URL}/${path}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch guide content: HTTP ${response.status}`);
    }
    return response.text();
}

/**
 * Strip YAML frontmatter from markdown content
 * Returns the content body without the --- delimited frontmatter block
 */
export function stripFrontmatter(raw: string): string {
    const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (match) {
        return raw.slice(match[0].length).trim();
    }
    return raw.trim();
}
