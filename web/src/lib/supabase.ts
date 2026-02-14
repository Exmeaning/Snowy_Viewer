import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==================== MULTI-SERVER CONFIGURATION ====================

export interface ServerConfig {
    id: string;
    name: string;
    region: string;
    url: string;
    anonKey: string;
}

export const SERVERS: ServerConfig[] = [
    {
        id: 'tokyo-1',
        name: '东京1区',
        region: '🇯🇵 日本',
        url: 'https://feyxctqbrpsuwnswtqei.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZleXhjdHFicnBzdXduc3d0cWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NzU3OTksImV4cCI6MjA4NjU1MTc5OX0.iFaBKW4AU6XxJau_nWrWxWxchAMGOXWNqIVYJIPYfOw',
    },
    {
        id: 'tokyo-2',
        name: '东京2区',
        region: '🇯🇵 日本',
        url: 'https://kcjsalozlbxxuupboslq.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjanNhbG96bGJ4eHV1cGJvc2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODk0NjgsImV4cCI6MjA4NjU2NTQ2OH0.kkII5UDg6nKOsKUBl6MVLuIWRKopVwsDrFM5BcHnEtA',
    },
    {
        id: 'tokyo-3',
        name: '东京3区',
        region: '🇯🇵 日本',
        url: 'https://oxnpfchskxvgwnwzhlwf.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94bnBmY2hza3h2Z3dud3pobHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODk3MDksImV4cCI6MjA4NjU2NTcwOX0.AXfW_xdHDm-JL7EptqLJ93cfpIVtZQhWtwCVqWgLEjU',
    },
    {
        id: 'seoul-1',
        name: '首尔1区',
        region: '🇰🇷 韩国',
        url: 'https://xembzvtfhohpzzipbmmv.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbWJ6dnRmaG9ocHp6aXBibW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODkyNzIsImV4cCI6MjA4NjU2NTI3Mn0.yLKthTekdi4ImozVyYoMXiRkvez0t1taVepoinoNVbg',
    },
    {
        id: 'singapore-1',
        name: '新加坡1区',
        region: '🇸🇬 新加坡',
        url: 'https://ivrqjbzftiatuotaclwg.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cnFqYnpmdGlhdHVvdGFjbHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDAzODAsImV4cCI6MjA4NjU3NjM4MH0.HiRq8IlZGLRjFEDl5IHLsiUijQKX0QWK1k76HDJBEQM',
    },
];

// ==================== CLIENT CACHE ====================

const clientCache = new Map<string, SupabaseClient>();

/** Get (or create) a Supabase client for a given server ID */
export function getSupabaseClient(serverId: string): SupabaseClient {
    const cached = clientCache.get(serverId);
    if (cached) return cached;

    const server = SERVERS.find(s => s.id === serverId);
    if (!server) {
        // Fallback to first server
        console.warn(`[Supabase] Unknown server ID "${serverId}", falling back to ${SERVERS[0].id}`);
        return getSupabaseClient(SERVERS[0].id);
    }

    const client = createClient(server.url, server.anonKey);
    clientCache.set(serverId, client);
    return client;
}

// Default client (backward compat)
export const supabase = getSupabaseClient('tokyo-1');

// ==================== ROOM CODE → SERVER MAPPING ====================

/** Deterministic hash of room code to pick a server */
export function getServerForRoomCode(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        hash = ((hash << 5) - hash) + code.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit int
    }
    const idx = Math.abs(hash) % SERVERS.length;
    return SERVERS[idx].id;
}

// ==================== LATENCY MEASUREMENT ====================

/** Measure round-trip latency to a server (ms). Returns -1 on failure. */
export async function measureLatency(serverId: string): Promise<number> {
    const server = SERVERS.find(s => s.id === serverId);
    if (!server) return -1;

    try {
        const start = performance.now();
        await fetch(`${server.url}/rest/v1/`, {
            method: 'HEAD',
            headers: {
                'apikey': server.anonKey,
                'Authorization': `Bearer ${server.anonKey}`,
            },
        });
        return Math.round(performance.now() - start);
    } catch {
        return -1;
    }
}

/** Measure latency for all servers in parallel */
export async function measureAllLatencies(): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    const promises = SERVERS.map(async (server) => {
        const latency = await measureLatency(server.id);
        results.set(server.id, latency);
    });
    await Promise.all(promises);
    return results;
}

// ==================== TYPES ====================

// Generate a 6-character room code
export function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export interface RoomPlayer {
    id: string; // unique session id
    characterId: number; // 1-26 Project Sekai character
    slot: number; // 1-4 (P1-P4)
    isHost: boolean;
}

export interface RoomRecord {
    id: string;
    code: string;
    host_character_id: number;
    players: RoomPlayer[];
    status: 'waiting' | 'playing' | 'finished';
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// ==================== CRUD (server-aware) ====================

// Create a new room in the database
export async function createRoom(code: string, hostPlayer: RoomPlayer, serverId?: string): Promise<RoomRecord | null> {
    const client = getSupabaseClient(serverId || 'tokyo-1');
    try {
        const { data, error } = await client
            .from('rooms')
            .insert({
                code,
                host_character_id: hostPlayer.characterId,
                players: [hostPlayer],
                status: 'waiting',
                settings: {},
            })
            .select()
            .single();

        if (error) {
            console.warn('[Supabase] Failed to create room (non-critical):', error.message || error);
            return null;
        }
        return data as RoomRecord;
    } catch (e) {
        console.warn('[Supabase] createRoom exception (non-critical):', e);
        return null;
    }
}

// Find a room by code on a specific server
export async function findRoom(code: string, serverId?: string): Promise<RoomRecord | null> {
    const client = getSupabaseClient(serverId || 'tokyo-1');
    try {
        const { data, error } = await client
            .from('rooms')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

        if (error) {
            console.warn('[Supabase] Failed to find room:', error.message || error);
            return null;
        }
        return data as RoomRecord;
    } catch (e) {
        console.warn('[Supabase] findRoom exception:', e);
        return null;
    }
}

/** Find a room across all servers. Returns the room and the server ID it was found on. */
export async function findRoomAcrossServers(code: string): Promise<{ room: RoomRecord; serverId: string } | null> {
    // Try the hashed server first
    const hashedServerId = getServerForRoomCode(code);
    const hashedResult = await findRoom(code, hashedServerId);
    if (hashedResult) return { room: hashedResult, serverId: hashedServerId };

    // Fallback: try all other servers
    for (const server of SERVERS) {
        if (server.id === hashedServerId) continue;
        const result = await findRoom(code, server.id);
        if (result) return { room: result, serverId: server.id };
    }

    return null;
}

// Update room players (best-effort, non-blocking)
export async function updateRoomPlayers(roomId: string, players: RoomPlayer[], serverId?: string): Promise<boolean> {
    const client = getSupabaseClient(serverId || 'tokyo-1');
    try {
        const { error } = await client
            .from('rooms')
            .update({ players, updated_at: new Date().toISOString() })
            .eq('id', roomId);

        if (error) {
            console.warn('[Supabase] Failed to update room players (non-critical):', error.message || error);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[Supabase] updateRoomPlayers exception (non-critical):', e);
        return false;
    }
}

// Update room status (best-effort, non-blocking)
export async function updateRoomStatus(roomId: string, status: 'waiting' | 'playing' | 'finished', serverId?: string): Promise<boolean> {
    const client = getSupabaseClient(serverId || 'tokyo-1');
    try {
        const { error } = await client
            .from('rooms')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', roomId);

        if (error) {
            console.warn('[Supabase] Failed to update room status (non-critical):', error.message || error);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[Supabase] updateRoomStatus exception (non-critical):', e);
        return false;
    }
}

// Delete a room (best-effort, non-blocking)
export async function deleteRoom(roomId: string, serverId?: string): Promise<boolean> {
    const client = getSupabaseClient(serverId || 'tokyo-1');
    try {
        const { error } = await client
            .from('rooms')
            .delete()
            .eq('id', roomId);

        if (error) {
            console.warn('[Supabase] Failed to delete room (non-critical):', error.message || error);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[Supabase] deleteRoom exception (non-critical):', e);
        return false;
    }
}
