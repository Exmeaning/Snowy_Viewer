/**
 * Song Constants (歌曲定数) data fetching and parsing
 * 
 * Source: Community chart constants (非官方, 仅供参考)
 * CSV columns: Song, JP Name, Constant, Level, Note Count, Difficulty, Song ID, Notes
 */

const SONG_CONSTANTS_CSV_URL = "https://moe.exmeaning.com/data/pjskb30/merged_chart.csv";

export interface SongConstantEntry {
    songId: number;
    constant: number;
    difficulty: string; // "Master" | "Append" | "Expert" | "Hard" | "Normal" | "Easy"
    noteCount: number;
}

// Normalize difficulty string from CSV to match game data keys
function normalizeDifficulty(diff: string): string {
    return diff.toLowerCase().trim();
}

/**
 * Fetch and parse song constants from CSV
 */
export async function fetchSongConstants(): Promise<SongConstantEntry[]> {
    const res = await fetch(SONG_CONSTANTS_CSV_URL);
    if (!res.ok) throw new Error(`Failed to fetch song constants: ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n");
    const entries: SongConstantEntry[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV may have quoted fields (e.g. "Help me, ERINNNNNN!!")
        // Use a simple CSV parser that handles quoted fields
        const fields = parseCSVLine(line);
        if (fields.length < 7) continue;

        const constant = parseFloat(fields[2]);
        const noteCount = parseInt(fields[4], 10);
        const difficulty = fields[5];
        const songId = parseInt(fields[6], 10);

        if (isNaN(songId) || isNaN(constant) || !difficulty) continue;

        entries.push({
            songId,
            constant,
            difficulty: normalizeDifficulty(difficulty),
            noteCount: isNaN(noteCount) ? 0 : noteCount,
        });
    }

    return entries;
}

/**
 * Build a map: songId → { difficulty → constant }
 */
export function buildSongConstantsMap(
    entries: SongConstantEntry[]
): Record<number, Record<string, number>> {
    const map: Record<number, Record<string, number>> = {};
    for (const entry of entries) {
        if (!map[entry.songId]) map[entry.songId] = {};
        map[entry.songId][entry.difficulty] = entry.constant;
    }
    return map;
}

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === "," && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}
