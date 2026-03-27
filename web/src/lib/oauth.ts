import type { ServerType } from "./account";

export interface OAuthPendingState {
    state: string;
    codeVerifier: string;
    returnTo: string;
    createdAt: number;
}

export interface OAuthTokenSet {
    accessToken: string;
    refreshToken: string | null;
    tokenType: string;
    scope: string[];
    expiresAt: number | null;
}

export interface OAuthProfile {
    [key: string]: unknown;
    id?: string;
    sub?: string;
    userId?: string | number;
    name?: string;
    nickname?: string;
    username?: string;
}

export interface OAuthBinding {
    [key: string]: unknown;
    id?: string | number;
    bindingId?: string | number;
    userId?: string | number;
    gameId?: string | number;
    uid?: string | number;
    server?: string;
    region?: string;
    verified?: boolean;
}

export interface OAuthAuthorizationResult {
    tokenSet: OAuthTokenSet;
    profile: OAuthProfile | null;
    bindings: OAuthBinding[];
}

export type OAuthAuthorizationPhase =
    | "validating_state"
    | "exchanging_token"
    | "loading_profile"
    | "loading_bindings";

const OAUTH2_BASE = (process.env.NEXT_PUBLIC_OAUTH2_BASE_URL || "https://toolbox-api-direct.haruki.seiunx.com/api/oauth2").replace(/\/+$/, "");
const OAUTH2_CLIENT_ID = process.env.NEXT_PUBLIC_OAUTH2_CLIENT_ID || "";
const OAUTH2_SCOPE = process.env.NEXT_PUBLIC_OAUTH2_SCOPE || "user:read bindings:read game-data:read";
const OAUTH2_REDIRECT_URI = process.env.NEXT_PUBLIC_OAUTH2_REDIRECT_URI || "";
const OAUTH_PENDING_KEY = "moesekai_oauth_pending";
const OAUTH_PENDING_TTL_MS = 10 * 60 * 1000;
const OAUTH2_REQUEST_TIMEOUT_MS = 15 * 1000;

export function getOAuthConfig() {
    return {
        baseUrl: OAUTH2_BASE,
        clientId: OAUTH2_CLIENT_ID,
        scope: OAUTH2_SCOPE,
        redirectUri: OAUTH2_REDIRECT_URI || getDefaultRedirectUri(),
    };
}

function getDefaultRedirectUri(): string {
    if (typeof window === "undefined") return "/oauth2/callback/code/";
    return new URL("/oauth2/callback/code/", window.location.origin).toString();
}

function assertOAuthConfig() {
    const config = getOAuthConfig();
    if (!config.clientId) {
        throw new Error("缺少 NEXT_PUBLIC_OAUTH2_CLIENT_ID 配置");
    }
    if (!config.redirectUri) {
        throw new Error("缺少 OAuth2 redirect URI 配置");
    }
    return config;
}

function toBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 64): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let result = "";
    for (let i = 0; i < bytes.length; i += 1) {
        result += chars[bytes[i]! % chars.length];
    }
    return result;
}

async function sha256Base64Url(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toBase64Url(digest);
}

function isOAuthPendingState(value: unknown): value is OAuthPendingState {
    return !!value
        && typeof value === "object"
        && !Array.isArray(value)
        && typeof (value as OAuthPendingState).state === "string"
        && typeof (value as OAuthPendingState).codeVerifier === "string"
        && typeof (value as OAuthPendingState).returnTo === "string"
        && typeof (value as OAuthPendingState).createdAt === "number";
}

function readPendingOAuthStateMap(): Record<string, OAuthPendingState> {
    if (typeof window === "undefined") return {};
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            clearPendingOAuthState();
            return {};
        }

        if (isOAuthPendingState(parsed)) {
            return { [parsed.state]: parsed };
        }

        const entries = Object.entries(parsed).filter(([, value]) => isOAuthPendingState(value));
        return Object.fromEntries(entries) as Record<string, OAuthPendingState>;
    } catch {
        clearPendingOAuthState();
        return {};
    }
}

function writePendingOAuthStateMap(map: Record<string, OAuthPendingState>): void {
    if (typeof window === "undefined") return;
    const entries = Object.entries(map);
    if (entries.length === 0) {
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        return;
    }
    sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function prunePendingOAuthStates(map: Record<string, OAuthPendingState>): Record<string, OAuthPendingState> {
    const now = Date.now();
    return Object.fromEntries(
        Object.entries(map).filter(([, pending]) => pending?.createdAt && now - pending.createdAt <= OAUTH_PENDING_TTL_MS),
    );
}

export async function startOAuthConnect(returnTo = "/profile"): Promise<void> {
    if (typeof window === "undefined") return;
    const config = assertOAuthConfig();
    const state = randomString(32);
    const codeVerifier = randomString(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);

    const pending: OAuthPendingState = {
        state,
        codeVerifier,
        returnTo,
        createdAt: Date.now(),
    };
    const nextPendingMap = prunePendingOAuthStates(readPendingOAuthStateMap());
    nextPendingMap[state] = pending;
    writePendingOAuthStateMap(nextPendingMap);

    const authorizeUrl = new URL(`${config.baseUrl}/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizeUrl.searchParams.set("scope", config.scope);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    window.location.href = authorizeUrl.toString();
}

export function getPendingOAuthState(state?: string | null): OAuthPendingState | null {
    if (typeof window === "undefined") return null;
    const pendingMap = prunePendingOAuthStates(readPendingOAuthStateMap());
    writePendingOAuthStateMap(pendingMap);

    if (state) {
        return pendingMap[state] || null;
    }

    const latest = Object.values(pendingMap).sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest || null;
}

export function clearPendingOAuthState(state?: string | null): void {
    if (typeof window === "undefined") return;
    if (!state) {
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        return;
    }

    const pendingMap = readPendingOAuthStateMap();
    delete pendingMap[state];
    writePendingOAuthStateMap(pendingMap);
}

export function getOAuthReturnTo(state?: string | null): string {
    return getPendingOAuthState(state)?.returnTo || "/profile";
}

export function formatOAuthErrorMessage(error: string): string {
    if (error === "access_denied") return "你已取消授权，未绑定任何账号。";
    if (error === "OAUTH_PENDING_MISSING") return "授权会话已失效，请重新发起 OAuth2 绑定。";
    if (error === "OAUTH_STATE_MISMATCH") return "授权状态校验失败，请重新发起 OAuth2 绑定。";
    if (error === "OAUTH_REAUTH_REQUIRED") return "当前授权已失效，请重新授权后再试。";
    if (error === "OAUTH_REQUEST_TIMEOUT") return "OAuth2 服务响应超时，请稍后重试。";
    if (error.startsWith("TOKEN_EXCHANGE_FAILED_")) return "授权码交换失败，请确认回调地址配置正确并重新授权。";
    if (error.startsWith("TOKEN_REFRESH_FAILED_")) return "授权刷新失败，请重新授权后再试。";
    if (error.startsWith("AUTHORIZED_REQUEST_FAILED_401")) return "授权已过期，请重新授权后再试。";
    if (error.startsWith("AUTHORIZED_REQUEST_FAILED_403")) return "当前授权权限不足或无权访问该账号数据。";
    if (error.startsWith("AUTHORIZED_REQUEST_FAILED_404")) return "未找到对应的授权资源或绑定数据。";
    if (error === "OAUTH_TOKEN_MISSING") return "当前账号缺少授权凭据，请重新授权后再试。";
    if (error === "INVALID_OAUTH_BINDING") return "无法识别当前授权账号绑定信息，请重新授权后再试。";
    if (error === "OAuth2 回调参数不完整") return error;
    return error || "OAuth2 处理失败，请稍后重试。";
}

async function oauthFetch(input: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OAUTH2_REQUEST_TIMEOUT_MS);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
            throw new Error("OAUTH_REQUEST_TIMEOUT");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function readJsonWithTimeout<T>(response: Response): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
        const text = await Promise.race<string>([
            response.text(),
            new Promise<string>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("OAUTH_REQUEST_TIMEOUT")), OAUTH2_REQUEST_TIMEOUT_MS);
            }),
        ]);

        if (!text.trim()) {
            return null as T;
        }

        return JSON.parse(text) as T;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

function reportOAuthPhase(phase: OAuthAuthorizationPhase, onPhaseChange?: (phase: OAuthAuthorizationPhase) => void) {
    console.info("[OAuth2]", phase);
    onPhaseChange?.(phase);
}

export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<OAuthTokenSet> {
    const config = assertOAuthConfig();
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
    });

    const response = await oauthFetch(`${config.baseUrl}/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`TOKEN_EXCHANGE_FAILED_${response.status}`);
    }

    const data = await readJsonWithTimeout<Record<string, unknown>>(response);
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in || 0);

    return {
        accessToken: String(data.access_token || ""),
        refreshToken: data.refresh_token ? String(data.refresh_token) : null,
        tokenType: String(data.token_type || "Bearer"),
        scope: typeof data.scope === "string" ? data.scope.split(/\s+/).filter(Boolean) : [],
        expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
    };
}

export async function refreshOAuthToken(refreshToken: string): Promise<OAuthTokenSet> {
    const config = assertOAuthConfig();
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        refresh_token: refreshToken,
    });

    const response = await oauthFetch(`${config.baseUrl}/token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`TOKEN_REFRESH_FAILED_${response.status}`);
    }

    const data = await readJsonWithTimeout<Record<string, unknown>>(response);
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : Number(data.expires_in || 0);

    return {
        accessToken: String(data.access_token || ""),
        refreshToken: data.refresh_token ? String(data.refresh_token) : refreshToken,
        tokenType: String(data.token_type || "Bearer"),
        scope: typeof data.scope === "string" ? data.scope.split(/\s+/).filter(Boolean) : [],
        expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
    };
}

export async function revokeOAuthToken(token: string): Promise<void> {
    const response = await oauthFetch(`${assertOAuthConfig().baseUrl}/revoke`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token }).toString(),
    });

    if (!response.ok) {
        throw new Error(`TOKEN_REVOKE_FAILED_${response.status}`);
    }
}

async function authorizedJson<T>(path: string, accessToken: string): Promise<T> {
    const response = await oauthFetch(`${assertOAuthConfig().baseUrl}${path}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`AUTHORIZED_REQUEST_FAILED_${response.status}_${path}`);
    }

    return readJsonWithTimeout<T>(response);
}

export async function fetchOAuthProfile(accessToken: string): Promise<OAuthProfile | null> {
    try {
        return await authorizedJson<OAuthProfile>("/user/profile", accessToken);
    } catch (error) {
        console.warn("[OAuth2] failed to load profile", error);
        return null;
    }
}

export async function fetchOAuthBindings(accessToken: string): Promise<OAuthBinding[]> {
    const data = await authorizedJson<unknown>("/user/bindings", accessToken);
    if (data == null) return [];
    if (Array.isArray(data)) return data as OAuthBinding[];
    if (data && typeof data === "object") {
        const maybeItems = (data as {
            bindings?: unknown;
            items?: unknown;
            updatedData?: unknown;
            data?: { bindings?: unknown; items?: unknown; updatedData?: unknown };
            result?: { bindings?: unknown; items?: unknown; updatedData?: unknown };
        }).bindings
            || (data as { items?: unknown }).items
            || (data as { updatedData?: unknown }).updatedData
            || (data as { data?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).data?.bindings
            || (data as { data?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).data?.items
            || (data as { data?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).data?.updatedData
            || (data as { result?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).result?.bindings
            || (data as { result?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).result?.items
            || (data as { result?: { bindings?: unknown; items?: unknown; updatedData?: unknown } }).result?.updatedData;
        if (Array.isArray(maybeItems)) return maybeItems as OAuthBinding[];
        console.warn("[OAuth2] unexpected bindings payload", data);
    }
    return [];
}

export function normalizeBindingServer(binding: OAuthBinding): ServerType | null {
    const raw = String(binding.server || binding.region || "").toLowerCase();
    if (raw === "jp" || raw === "cn" || raw === "tw") return raw;
    return null;
}

export function normalizeBindingGameId(binding: OAuthBinding): string | null {
    const value = binding.gameId ?? binding.userId ?? binding.uid;
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

export async function fetchOAuthGameData(accessToken: string, server: ServerType, dataType: string, userId: string): Promise<unknown> {
    return authorizedJson(`/game-data/${server}/${encodeURIComponent(dataType)}/${encodeURIComponent(userId)}`, accessToken);
}

export async function fetchOAuthGameDataSuite(accessToken: string, server: ServerType, userId: string): Promise<Record<string, unknown>> {
    return (await authorizedJson<Record<string, unknown> | null>(`/game-data/${server}/suite/${encodeURIComponent(userId)}`, accessToken)) ?? {};
}

export async function resolveOAuthAuthorization(
    code: string,
    state: string,
    onPhaseChange?: (phase: OAuthAuthorizationPhase) => void,
): Promise<OAuthAuthorizationResult> {
    reportOAuthPhase("validating_state", onPhaseChange);
    const pending = getPendingOAuthState(state);
    if (!pending) {
        throw new Error("OAUTH_PENDING_MISSING");
    }
    if (Date.now() - pending.createdAt > OAUTH_PENDING_TTL_MS) {
        clearPendingOAuthState(state);
        throw new Error("OAUTH_PENDING_MISSING");
    }
    if (pending.state !== state) {
        clearPendingOAuthState(state);
        throw new Error("OAUTH_STATE_MISMATCH");
    }

    reportOAuthPhase("exchanging_token", onPhaseChange);
    const tokenSet = await exchangeCodeForToken(code, pending.codeVerifier);
    reportOAuthPhase("loading_profile", onPhaseChange);
    const profile = await fetchOAuthProfile(tokenSet.accessToken);
    reportOAuthPhase("loading_bindings", onPhaseChange);
    const bindings = await fetchOAuthBindings(tokenSet.accessToken);

    return { tokenSet, profile, bindings };
}
