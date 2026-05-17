import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import type { AssetSourceType } from "@/contexts/ThemeContext";
import { getCardFullUrl } from "@/lib/assets";
import {
    getCustomFixtureAttachObjectPaths,
    getCustomFixtureAttachTexturePaths,
    getFixtureObjectPaths,
    getFixtureTexturePaths,
    getMusicJacketTexturePath,
    getMysekaiCandidateRawUrls,
    getMysekaiMasterDataUrls,
    getOutdoorGrassTexturePath,
    getRoomSkinDoorObjectPaths,
    getRoomSkinDoorTexturePath,
    getRoomSkinFloorTexturePath,
    getRoomSkinWallTexturePath,
} from "./assets";
import type {
    ExtractedMysekaiEntry,
    MysekaiCustomFixtureMaster,
    MysekaiFixtureMaster,
    MysekaiLayoutData,
    MysekaiLayoutItem,
    MysekaiPreviewOptions,
    MysekaiPreviewStatus,
    MysekaiRankReleaseMaster,
    MysekaiSceneSize,
    MysekaiSiteLayoutMaster,
    MysekaiSiteLevelMaster,
} from "./types";

const GLOBAL_SCALE = 4;
const ALWAYS_ENABLED_LAYOUT_TYPES = ["floor", "rug", "road", "wall_left", "wall_right", "wall_front", "wall_back"];
const INDOOR_TYPES = ["floor", "rug", "wall_left", "wall_right", "wall_front", "wall_back"];
const SHADOW_Y_OFFSET = 0.004;

const GATE_ASSET_BY_ID: Record<number, string> = {
    1: "mdl_non0006_gate_lon1",
    2: "mdl_non0006_gate_mmj1",
    3: "mdl_non0006_gate_vbs1",
    4: "mdl_non0006_gate_wns1",
    5: "mdl_non0006_gate_nig1",
};

interface RuntimeCallbacks {
    onStatus?: (status: MysekaiPreviewStatus) => void;
}

interface ResourcePick {
    url: string;
    source: AssetSourceType;
}

interface RoomSkinAssetInfo {
    asset: string;
    floorTexUrl?: string;
    wallTexUrl?: string;
    doorTexUrl?: string;
    doorObjUrls: string[];
}

interface ExtractEntriesResult {
    entries: ExtractedMysekaiEntry[];
    playerRank: number;
    effectiveTypes: string[];
}

interface SurfaceAppearanceInfo {
    floor: MysekaiLayoutItem | null;
    wall: MysekaiLayoutItem | null;
}

interface FloorPlacementRecord {
    object: THREE.Object3D;
    bbox: THREE.Box3;
    bottomY: number;
    topY: number;
    cellKeys: string[];
    customPartType: string | null;
}

interface FloorShadowRecord {
    object: THREE.Object3D;
    shadow: THREE.Mesh;
}

interface ObjStats {
    url: string;
    volume: number;
    vertexCount: number;
}

interface FixtureRenderAsset {
    asset: string;
    isOrnament: boolean;
    useCustomAttachRoot: boolean;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isMesh(object: THREE.Object3D): object is THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> {
    return object instanceof THREE.Mesh;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) {
        for (const item of material) item.dispose();
        return;
    }
    material.dispose();
}

function disposeObject(root: THREE.Object3D) {
    root.traverse((object) => {
        if (!isMesh(object)) return;
        object.geometry.dispose();
        disposeMaterial(object.material);
    });
}

function normalizeFiniteNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function modPos(value: number, mod: number): number {
    return ((value % mod) + mod) % mod;
}

function mapLayoutToScenePos(position: { x?: number; y?: number; z?: number } | undefined) {
    return {
        x: normalizeFiniteNumber(position?.x),
        y: normalizeFiniteNumber(position?.y),
        z: -normalizeFiniteNumber(position?.z),
    };
}

function mapLayoutToSceneRotDeg(rotation: unknown): number {
    return -normalizeFiniteNumber(rotation);
}

function isShadowObjUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes("shadow") || lower.includes("_sdw") || lower.includes("kage");
}

function getDollSizeValue(sizeName: string): number | null {
    if (sizeName === "small") return 0.8;
    if (sizeName === "medium") return 1.1;
    if (sizeName === "large") return 2;
    return null;
}

function parseDollSizeFromName(name: string | undefined): string | null {
    const lower = String(name || "").toLowerCase();
    const match = lower.match(/mdl_pas\d+_fixture_doll\d+(small|medium|large)/);
    return match ? match[1] : null;
}

function applyDollFixtureSizeCorrection(object: THREE.Object3D, assetName: string) {
    const targetSize = parseDollSizeFromName(assetName);
    if (!targetSize) return;

    const weighted: Record<string, number> = { small: 0, medium: 0, large: 0 };
    object.traverse((node) => {
        if (!isMesh(node)) return;
        const detected = parseDollSizeFromName(node.name);
        if (!detected) return;
        weighted[detected] += node.geometry.attributes.position?.count ?? 0;
    });

    let sourceSize: string | null = null;
    let best = 0;
    for (const key of ["small", "medium", "large"]) {
        if (weighted[key] > best) {
            best = weighted[key];
            sourceSize = key;
        }
    }

    if (!sourceSize || sourceSize === targetSize) return;
    const sourceValue = getDollSizeValue(sourceSize);
    const targetValue = getDollSizeValue(targetSize);
    if (!(sourceValue && targetValue)) return;
    object.scale.multiplyScalar(targetValue / sourceValue);
}

function locateObject(
    object: THREE.Object3D,
    x: number,
    z: number,
    y: number,
    width: number,
    depth: number,
    _height: number,
    rotationYRad: number,
    layoutType: string,
): THREE.Object3D {
    let x0 = x;
    let z0 = z;
    let x1 = x0;
    let z1 = z0;
    const widthOdd = width % 2 === 1;
    const depthOdd = depth % 2 === 1;

    if (!layoutType.startsWith("wall_")) {
        x0 += widthOdd ? 0.5 : 1;
        z0 -= depthOdd ? 0.5 : 1;
        x1 = x0;
        z1 = z0;
        if (widthOdd !== depthOdd) {
            if (width > depth) z1 -= 0.5;
            else x1 += 0.5;
        }
    } else {
        const wallWidth = Math.max(width, depth);
        if (wallWidth % 2 === 1) {
            if (layoutType === "wall_back") x0 -= 0.5;
            else if (layoutType === "wall_front") x0 += 0.5;
            else if (layoutType === "wall_left") z0 += 0.5;
            else if (layoutType === "wall_right") z0 -= 0.5;
        }
        x1 = x0;
        z1 = z0;
    }

    object.scale.multiplyScalar(GLOBAL_SCALE);
    object.rotateY(Math.PI);
    object.position.set(x0, y, z0);

    const pivotRotate = new THREE.Matrix4()
        .makeTranslation(x1, 0, z1)
        .multiply(new THREE.Matrix4().makeRotationY(rotationYRad))
        .multiply(new THREE.Matrix4().makeTranslation(-x1, 0, -z1));
    object.applyMatrix4(pivotRotate);
    object.updateMatrixWorld(true);
    return object;
}

function captureWorldBBox(object: THREE.Object3D): THREE.Box3 {
    object.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(object);
}

function getXZCellKeysFromBBox(bbox: THREE.Box3): string[] {
    const minX = Math.floor(bbox.min.x + 0.5);
    const maxX = Math.ceil(bbox.max.x + 0.5);
    const minZ = Math.floor(bbox.min.z + 0.5);
    const maxZ = Math.ceil(bbox.max.z + 0.5);
    const keys: string[] = [];
    for (let x = minX; x < maxX; x++) {
        for (let z = minZ; z < maxZ; z++) {
            keys.push(`${x},${z}`);
        }
    }
    return keys;
}

function calcBBoxXZAreaOverlayRatio(a: THREE.Box3, b: THREE.Box3): number {
    const minX = Math.max(a.min.x, b.min.x);
    const maxX = Math.min(a.max.x, b.max.x);
    const minZ = Math.max(a.min.z, b.min.z);
    const maxZ = Math.min(a.max.z, b.max.z);
    if (minX > maxX || minZ > maxZ) return 0;
    const areaA = (a.max.x - a.min.x) * (a.max.z - a.min.z);
    const areaB = (b.max.x - b.min.x) * (b.max.z - b.min.z);
    const denom = Math.min(areaA, areaB);
    if (!(denom > 1e-12)) return 0;
    return ((maxX - minX) * (maxZ - minZ)) / denom;
}

function createSkyGradientBackground(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#5ea8ff");
    grad.addColorStop(0.38, "#8fc8ff");
    grad.addColorStop(0.72, "#c6e6ff");
    grad.addColorStop(1, "#eef7ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export class MysekaiScenePreviewRuntime {
    private readonly container: HTMLElement;
    private readonly axesContainer: HTMLElement;
    private readonly callbacks: RuntimeCallbacks;
    private readonly renderer: THREE.WebGLRenderer;
    private readonly axesRenderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly axesScene = new THREE.Scene();
    private readonly camera: THREE.PerspectiveCamera;
    private readonly axesCamera: THREE.PerspectiveCamera;
    private readonly controls: OrbitControls;
    private readonly ambientLight = new THREE.AmbientLight(0xffffff, 2);
    private readonly directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    private readonly contentGroup = new THREE.Group();
    private readonly textureLoader = new THREE.TextureLoader();
    private readonly objLoader = new OBJLoader();
    private readonly objTextCache = new Map<string, string>();
    private readonly objGroupCache = new Map<string, THREE.Group>();
    private readonly objStatsCache = new Map<string, ObjStats>();
    private readonly textureCache = new Map<string, THREE.Texture>();
    private readonly fixtureMetaMap = new Map<number, MysekaiFixtureMaster>();
    private readonly customFixtureMetaMap = new Map<number, MysekaiCustomFixtureMaster>();
    private readonly cardAssetById = new Map<number, string>();
    private readonly cardCharacterIdById = new Map<number, number>();
    private readonly externalMusicIdByMysekaiMusicRecordId = new Map<number, number>();
    private readonly musicAssetById = new Map<number, string>();
    private readonly indoorWallPlanes: THREE.Mesh[] = [];
    private readonly keyState = { w: false, s: false, a: false, d: false, space: false, shift: false };
    private rankReleases: MysekaiRankReleaseMaster[] = [];
    private siteLevels: MysekaiSiteLevelMaster[] = [];
    private siteLayouts: MysekaiSiteLayoutMaster[] = [];
    private gridMinor: THREE.GridHelper | null = null;
    private gridMajor: THREE.GridHelper | null = null;
    private indoorDoorObject: THREE.Object3D | null = null;
    private grass: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    private axisHelper: THREE.AxesHelper;
    private rafId = 0;
    private disposed = false;
    private masterLoaded = false;
    private cardsLoaded = false;
    private musicLoaded = false;
    private restoredCameraState = false;
    private options: MysekaiPreviewOptions;
    private currentStatus: MysekaiPreviewStatus = { phase: "idle", message: "初始化中...", loaded: 0, total: 0, skipped: 0 };

    constructor(container: HTMLElement, axesContainer: HTMLElement, options: MysekaiPreviewOptions, callbacks: RuntimeCallbacks = {}) {
        this.container = container;
        this.axesContainer = axesContainer;
        this.options = { ...options };
        this.callbacks = callbacks;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
        this.renderer.domElement.className = "absolute inset-0 h-full w-full";
        container.appendChild(this.renderer.domElement);

        this.axesRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.axesRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.axesRenderer.setSize(axesContainer.clientWidth || 1, axesContainer.clientHeight || 1);
        this.axesRenderer.domElement.className = "absolute inset-0 h-full w-full";
        axesContainer.appendChild(this.axesRenderer.domElement);

        this.textureLoader.setCrossOrigin("anonymous");
        this.scene.background = createSkyGradientBackground();
        this.camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 1400);
        this.camera.position.set(60, 45, 60);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.minDistance = 0.05;
        this.controls.addEventListener("end", this.saveCameraState);

        this.axesCamera = new THREE.PerspectiveCamera(50, (axesContainer.clientWidth || 1) / (axesContainer.clientHeight || 1), 0.1, 10);
        this.axisHelper = new THREE.AxesHelper(1.2);
        this.axesScene.add(this.axisHelper);

        this.directionalLight.position.set(50, 120, 30);
        this.scene.add(this.ambientLight, this.directionalLight, this.contentGroup);
        this.grass = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0x8fb77a, side: THREE.DoubleSide }),
        );
        this.grass.rotation.x = -Math.PI * 0.5;
        this.grass.visible = false;
        this.scene.add(this.grass);

        const originMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 14, 10),
            new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.95 }),
        );
        originMarker.userData.debugOnly = true;
        this.scene.add(originMarker);

        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
        window.addEventListener("resize", this.handleResize);
        window.addEventListener("beforeunload", this.saveCameraState);
        this.loadCameraState();
        this.handleResize();
        this.tick();
    }

    updateOptions(options: MysekaiPreviewOptions) {
        const oldSiteId = this.options.siteId;
        const oldLayoutUrl = this.options.layoutUrl;
        const oldAssetSource = this.options.assetSource;
        this.options = { ...options };
        this.applyDebugVisibility();
        this.applyShadowVisibility();
        this.applyBackWallOpacity();
        if (oldSiteId !== options.siteId || oldLayoutUrl !== options.layoutUrl || oldAssetSource !== options.assetSource) {
            void this.reload(false);
        }
    }

    async reload(forceFreshLayout = true) {
        if (this.disposed) return;
        try {
            this.saveCameraState();
            this.setStatus({ phase: "loading", stage: "master", stageLabel: "正在加载 master data", progress: 3, message: "加载 master data...", loaded: 0, total: 0, skipped: 0, ignored: 0, failed: 0 });
            await this.ensureMasterDataLoaded();
            await this.buildScene(forceFreshLayout);
        } catch (error) {
            console.error(error);
            this.setStatus({ phase: "error", stage: "error", stageLabel: "加载失败", progress: 100, message: `失败: ${errorMessage(error)}`, loaded: 0, total: 0, skipped: 0, ignored: 0, failed: 1 });
        }
    }

    resetCamera() {
        this.restoredCameraState = false;
        this.controls.target.set(0, 0, 0);
        this.camera.position.set(60, 45, 60);
        this.camera.up.set(0, 1, 0);
        this.controls.update();
        this.saveCameraState();
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.rafId);
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        window.removeEventListener("resize", this.handleResize);
        window.removeEventListener("beforeunload", this.saveCameraState);
        this.controls.removeEventListener("end", this.saveCameraState);
        this.controls.dispose();
        this.clearContent();
        this.clearGrid();
        this.clearIndoorWalls();
        disposeObject(this.grass);
        this.scene.remove(this.grass);
        this.textureCache.forEach((texture) => texture.dispose());
        this.renderer.dispose();
        this.axesRenderer.dispose();
        this.renderer.domElement.remove();
        this.axesRenderer.domElement.remove();
    }

    private setStatus(status: MysekaiPreviewStatus) {
        this.currentStatus = status;
        this.callbacks.onStatus?.(status);
    }

    private mergeStatus(partial: Partial<MysekaiPreviewStatus>) {
        this.setStatus({ ...this.currentStatus, ...partial });
    }

    private async fetchJson<T>(urls: string[], label: string, forceFresh = false): Promise<T> {
        let lastError = "";
        for (const baseUrl of urls) {
            const url = forceFresh ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}_ts=${Date.now()}` : baseUrl;
            try {
                const response = await fetch(url, forceFresh ? { cache: "no-store" } : undefined);
                if (!response.ok) {
                    lastError = `${response.status} ${response.statusText}`;
                    continue;
                }
                return await response.json() as T;
            } catch (error) {
                lastError = errorMessage(error);
            }
        }
        throw new Error(`加载失败: ${label}${lastError ? ` (${lastError})` : ""}`);
    }

    private async ensureMasterDataLoaded() {
        if (this.masterLoaded) return;
        const source = this.options.assetSource;
        const [fixtures, customFixtures, rankReleases, siteLevels, siteLayouts] = await Promise.all([
            this.fetchJson<MysekaiFixtureMaster[]>(getMysekaiMasterDataUrls("mysekaiFixtures.json", source), "mysekaiFixtures.json"),
            this.fetchJson<MysekaiCustomFixtureMaster[]>(getMysekaiMasterDataUrls("mysekaiCustomFixtures.json", source), "mysekaiCustomFixtures.json"),
            this.fetchJson<MysekaiRankReleaseMaster[]>(getMysekaiMasterDataUrls("mysekaiRankReleases.json", source), "mysekaiRankReleases.json"),
            this.fetchJson<MysekaiSiteLevelMaster[]>(getMysekaiMasterDataUrls("mysekaiSiteLevels.json", source), "mysekaiSiteLevels.json"),
            this.fetchJson<MysekaiSiteLayoutMaster[]>(getMysekaiMasterDataUrls("mysekaiSiteLayouts.json", source), "mysekaiSiteLayouts.json"),
        ]);
        this.fixtureMetaMap.clear();
        this.customFixtureMetaMap.clear();
        for (const fixture of fixtures || []) this.fixtureMetaMap.set(Number(fixture.id), fixture);
        for (const custom of customFixtures || []) this.customFixtureMetaMap.set(Number(custom.id), custom);
        this.rankReleases = rankReleases || [];
        this.siteLevels = siteLevels || [];
        this.siteLayouts = siteLayouts || [];
        this.masterLoaded = true;
    }

    private async ensureCardsLoaded() {
        if (this.cardsLoaded) return;
        const cards = await this.fetchJson<Array<{ id?: number; characterId?: number; assetbundleName?: string }>>(getMysekaiMasterDataUrls("cards.json", this.options.assetSource), "cards.json");
        this.cardAssetById.clear();
        this.cardCharacterIdById.clear();
        for (const card of cards || []) {
            this.cardAssetById.set(Number(card.id), String(card.assetbundleName || ""));
            this.cardCharacterIdById.set(Number(card.id), Number(card.characterId || 0));
        }
        this.cardsLoaded = true;
    }

    private async ensureMusicDataLoaded() {
        if (this.musicLoaded) return;
        const [records, musics] = await Promise.all([
            this.fetchJson<Array<{ id?: number; externalId?: number }>>(getMysekaiMasterDataUrls("mysekaiMusicRecords.json", this.options.assetSource), "mysekaiMusicRecords.json"),
            this.fetchJson<Array<{ id?: number; assetbundleName?: string }>>(getMysekaiMasterDataUrls("musics.json", this.options.assetSource), "musics.json"),
        ]);
        this.externalMusicIdByMysekaiMusicRecordId.clear();
        this.musicAssetById.clear();
        for (const record of records || []) this.externalMusicIdByMysekaiMusicRecordId.set(Number(record.id), Number(record.externalId));
        for (const music of musics || []) this.musicAssetById.set(Number(music.id), String(music.assetbundleName || ""));
        this.musicLoaded = true;
    }

    private async fetchTextFirst(urls: string[]): Promise<ResourcePick | null> {
        for (const url of urls) {
            try {
                if (this.objTextCache.has(url)) return { url, source: this.options.assetSource };
                const response = await fetch(url);
                if (!response.ok) continue;
                const text = await response.text();
                if (!text.trim()) continue;
                this.objTextCache.set(url, text);
                return { url, source: this.options.assetSource };
            } catch {
                // try next candidate
            }
        }
        return null;
    }

    private getObjCandidateUrls(assetName: string, useCustomAttachRoot: boolean, handleType?: string, fixtureType?: string): string[] {
        const paths = useCustomAttachRoot
            ? getCustomFixtureAttachObjectPaths(assetName)
            : getFixtureObjectPaths(assetName, handleType, fixtureType);
        return paths.flatMap((path) => getMysekaiCandidateRawUrls(path, this.options.assetSource));
    }

    private async getObjGroup(url: string): Promise<THREE.Group> {
        const cached = this.objGroupCache.get(url);
        if (cached) return cached.clone(true);
        let text = this.objTextCache.get(url);
        if (!text) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`模型加载失败: ${url}`);
            text = await response.text();
            this.objTextCache.set(url, text);
        }
        const group = this.objLoader.parse(text);
        this.objGroupCache.set(url, group);
        return group.clone(true);
    }

    private async getObjStats(url: string): Promise<ObjStats> {
        const cached = this.objStatsCache.get(url);
        if (cached) return cached;
        const group = await this.getObjGroup(url);
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        let vertexCount = 0;
        group.traverse((node) => {
            if (!isMesh(node)) return;
            vertexCount += node.geometry.attributes.position?.count ?? 0;
        });
        const stats = {
            url,
            volume: Math.max(0, size.x) * Math.max(0, size.y) * Math.max(0, size.z),
            vertexCount,
        };
        this.objStatsCache.set(url, stats);
        return stats;
    }

    private async pickPrimaryObjUrl(urls: string[]): Promise<string | null> {
        const filtered = urls.filter((url) => !isShadowObjUrl(url));
        const candidates = filtered.length ? filtered : urls;
        const existing: string[] = [];
        for (const url of candidates) {
            const pick = await this.fetchTextFirst([url]);
            if (pick) existing.push(url);
        }
        if (!existing.length) return null;
        const stats = await Promise.all(existing.map((url) => this.getObjStats(url)));
        stats.sort((a, b) => {
            const volumeDiff = b.volume - a.volume;
            if (Math.abs(volumeDiff) > 1e-6) return volumeDiff;
            const vertexDiff = b.vertexCount - a.vertexCount;
            if (vertexDiff !== 0) return vertexDiff;
            return a.url.localeCompare(b.url);
        });
        return stats[0].url;
    }

    private async getTextureFromUrls(urls: string[]): Promise<THREE.Texture | null> {
        for (const url of urls) {
            const cached = this.textureCache.get(url);
            if (cached) return cached;
            try {
                const texture = await this.textureLoader.loadAsync(url);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = true;
                this.textureCache.set(url, texture);
                return texture;
            } catch {
                // try next texture candidate
            }
        }
        return null;
    }

    private async getFixtureTexture(assetName: string, textureId: number, useCustomAttachRoot: boolean, handleType?: string): Promise<THREE.Texture | null> {
        const paths = useCustomAttachRoot
            ? getCustomFixtureAttachTexturePaths(assetName, textureId)
            : getFixtureTexturePaths(assetName, textureId, handleType);
        return this.getTextureFromUrls(paths.flatMap((path) => getMysekaiCandidateRawUrls(path, this.options.assetSource)));
    }

    private createFallbackTexture(color = "#cfd3d8"): THREE.CanvasTexture {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 64, 64);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    private async getCanvasCardTexture(item: MysekaiLayoutItem): Promise<THREE.Texture> {
        const cardId = Number(item.cardId || 0);
        if (!cardId) return this.createFallbackTexture();
        await this.ensureCardsLoaded();
        const cardAsset = this.cardAssetById.get(cardId);
        if (!cardAsset) return this.createFallbackTexture();
        const cardCharacterId = this.cardCharacterIdById.get(cardId) || 0;
        const texture = await this.getTextureFromUrls([getCardFullUrl(cardCharacterId, cardAsset, !!item.isSpecialTraining, this.options.assetSource)]);
        return texture ?? this.createFallbackTexture();
    }

    private async getRecordJacketTexture(item: MysekaiLayoutItem): Promise<THREE.Texture> {
        const recordId = Number(item.mysekaiMusicRecordId || 0);
        if (!recordId) return this.createFallbackTexture();
        await this.ensureMusicDataLoaded();
        const musicId = this.externalMusicIdByMysekaiMusicRecordId.get(recordId);
        if (!musicId) return this.createFallbackTexture();
        const musicAsset = this.musicAssetById.get(musicId);
        if (!musicAsset) return this.createFallbackTexture();
        const texture = await this.getTextureFromUrls(getMysekaiCandidateRawUrls(getMusicJacketTexturePath(musicAsset), this.options.assetSource));
        return texture ?? this.createFallbackTexture();
    }

    private cloneWithMaterial(object: THREE.Object3D, materialFactory: () => THREE.Material): THREE.Object3D {
        const out = object.clone(true);
        out.traverse((node) => {
            if (!isMesh(node)) return;
            node.geometry = node.geometry.clone();
            node.material = materialFactory();
        });
        return out;
    }

    private cloneCanvasWithCardMaterial(object: THREE.Object3D, materialFactory: () => THREE.MeshLambertMaterial, cardTexture: THREE.Texture, fixtureId: number): THREE.Object3D {
        const suffix = fixtureId === 439 || fixtureId === 440 || fixtureId === 442 ? "_1" : "_0";
        const out = object.clone(true);
        out.traverse((node) => {
            if (!isMesh(node)) return;
            node.geometry = node.geometry.clone();
            const material = materialFactory();
            if (String(node.name || "").endsWith(suffix)) {
                material.map = cardTexture;
                material.color.set(0xffffff);
            }
            node.material = material;
        });
        return out;
    }

    private cloneCustomWithDisplayTexture(object: THREE.Object3D, materialFactory: () => THREE.MeshLambertMaterial, displayTexture: THREE.Texture | null): THREE.Object3D {
        const out = object.clone(true);
        let target: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | null = null;
        out.traverse((node) => {
            if (!isMesh(node) || target) return;
            if (String(node.name || "").toLowerCase().includes("preview")) return;
            target = node;
        });
        out.traverse((node) => {
            if (!isMesh(node)) return;
            node.geometry = node.geometry.clone();
            const material = materialFactory();
            if (target && node === target && displayTexture) {
                material.map = displayTexture;
                material.color.set(0xffffff);
            }
            node.material = material;
        });
        return out;
    }

    private clearContent() {
        while (this.contentGroup.children.length) {
            const child = this.contentGroup.children.pop();
            if (child) disposeObject(child);
        }
    }

    private clearGrid() {
        if (this.gridMinor) {
            this.scene.remove(this.gridMinor);
            this.gridMinor.geometry.dispose();
            disposeMaterial(this.gridMinor.material);
            this.gridMinor = null;
        }
        if (this.gridMajor) {
            this.scene.remove(this.gridMajor);
            this.gridMajor.geometry.dispose();
            disposeMaterial(this.gridMajor.material);
            this.gridMajor = null;
        }
    }

    private clearIndoorWalls() {
        for (const wall of this.indoorWallPlanes) {
            this.scene.remove(wall);
            disposeObject(wall);
        }
        this.indoorWallPlanes.length = 0;
        if (this.indoorDoorObject) {
            this.contentGroup.remove(this.indoorDoorObject);
            disposeObject(this.indoorDoorObject);
            this.indoorDoorObject = null;
        }
    }

    private clearBeforeBuild() {
        this.clearContent();
        this.clearGrid();
        this.clearIndoorWalls();
        this.grass.visible = false;
        this.grass.material.map = null;
        this.grass.material.color.set(0x8fb77a);
        this.grass.material.needsUpdate = true;
    }

    private applyLightingPreset(isOutdoor: boolean) {
        this.ambientLight.intensity = isOutdoor ? 1.2 : 2;
        this.directionalLight.intensity = isOutdoor ? 1.6 : 1;
    }

    private extractEntries(layoutData: MysekaiLayoutData | MysekaiLayoutData[], siteId: number): ExtractEntriesResult {
        const effectiveTypes = siteId === 1 ? ALWAYS_ENABLED_LAYOUT_TYPES : INDOOR_TYPES;
        const wanted = new Set(effectiveTypes);
        const entries: ExtractedMysekaiEntry[] = [];
        const customArrays = [
            "mysekaiCustomFixtureCollections",
            "mysekaiCustomFixturePenlights",
            "mysekaiCustomFixtureHonors",
            "mysekaiCustomFixtureBondsHonors",
            "mysekaiCustomFixtureRecordJackets",
            "mysekaiCustomFixturePhotos",
        ] as const;

        const pushGroupEntries = (group: { [key: string]: unknown; mysekaiLayoutType?: string }) => {
            const layoutType = group.mysekaiLayoutType || "";
            if (!wanted.has(layoutType)) return;
            for (const item of (group.mysekaiFixtures as MysekaiLayoutItem[] | undefined) || []) entries.push({ layoutType, item });
            for (const item of (group.mysekaiCanvases as MysekaiLayoutItem[] | undefined) || []) entries.push({ layoutType, item });
            for (const item of (group.mysekaiGrowingPlants as MysekaiLayoutItem[] | undefined) || []) entries.push({ layoutType, item: { ...item, __isGrowingPlant: true } });
            for (const key of customArrays) {
                for (const item of (group[key] as MysekaiLayoutItem[] | undefined) || []) {
                    entries.push({ layoutType, item: { ...item, __isCustomFixture: true, __customGroupKey: key } });
                }
            }
        };

        if (Array.isArray(layoutData)) {
            for (const group of layoutData) pushGroupEntries(group as { [key: string]: unknown; mysekaiLayoutType?: string });
            return { entries, playerRank: 1, effectiveTypes };
        }

        const site = layoutData.userMysekaiSiteHousingLayouts?.find((item) => Number(item.mysekaiSiteId) === siteId);
        for (const group of site?.mysekaiSiteHousingLayouts || []) pushGroupEntries(group as { [key: string]: unknown; mysekaiLayoutType?: string });
        return { entries, playerRank: Number(layoutData.mysekaiRank || 1), effectiveTypes };
    }

    private getIgnoredReason(entry: ExtractedMysekaiEntry): string | null {
        if (entry.item.__isCustomFixture) return null;
        const fixtureId = Number(entry.item.mysekaiFixtureId);
        const meta = this.fixtureMetaMap.get(fixtureId);
        if (meta?.mysekaiFixtureHandleType === "block_transparent") return "block_transparent";
        return null;
    }

    private getSiteLevelIdByRank(mysekaiRank: number, siteId: number): number | null {
        const unlocked = new Set(
            this.rankReleases
                .filter((item) => item.mysekaiRankRelaseType === "mysekai_site_level" && Number(item.mysekaiRank) <= mysekaiRank)
                .map((item) => Number(item.externalId)),
        );
        const candidates = this.siteLevels
            .filter((item) => Number(item.mysekaiSiteId) === siteId && unlocked.has(Number(item.id)))
            .sort((a, b) => Number(b.level || 0) - Number(a.level || 0));
        return candidates.length ? Number(candidates[0].id) : null;
    }

    private getSiteSize(siteLevelId: number | null): MysekaiSceneSize {
        if (!siteLevelId) return { width: 80, depth: 80, height: 10 };
        const floor = this.siteLayouts.find((item) => Number(item.mysekaiSiteLevelId) === siteLevelId && item.mysekaiLayoutType === "floor");
        if (!floor) return { width: 80, depth: 80, height: 10 };
        return { width: Number(floor.width || 80), depth: Number(floor.depth || 80), height: Number(floor.height || 10) };
    }

    private mapWallLayoutToScenePos(layoutType: string, position: MysekaiLayoutItem["position"], size: MysekaiSceneSize) {
        const halfW = Number(size.width || 80) / 2;
        const halfD = Number(size.depth || 80) / 2;
        const px = normalizeFiniteNumber(position?.x);
        const py = normalizeFiniteNumber(position?.y);
        const wallEps = 0.01;
        if (layoutType === "wall_back") return { x: px + 1, y: py, z: -halfD + wallEps };
        if (layoutType === "wall_front") return { x: -px - 1, y: py, z: halfD - wallEps };
        if (layoutType === "wall_left") return { x: -halfW + wallEps, y: py, z: -px - 1 };
        if (layoutType === "wall_right") return { x: halfW - wallEps, y: py, z: px + 1 };
        return mapLayoutToScenePos(position);
    }

    private getIndoorSurfaceAppearance(layoutData: MysekaiLayoutData | MysekaiLayoutData[], siteId: number): SurfaceAppearanceInfo {
        if (Array.isArray(layoutData)) return { floor: null, wall: null };
        const site = layoutData.userMysekaiSiteHousingLayouts?.find((item) => Number(item.mysekaiSiteId) === siteId);
        const out: SurfaceAppearanceInfo = { floor: null, wall: null };
        for (const item of site?.mysekaiFixtureSurfaceAppearances || []) {
            const normalized: MysekaiLayoutItem = { mysekaiFixtureId: item.mysekaiFixtureId, textureId: item.textureId };
            if (item.mysekaiFixtureSurfaceAppearanceType === "floor_appearance") out.floor = normalized;
            else if (item.mysekaiFixtureSurfaceAppearanceType === "wall_appearance") out.wall = normalized;
        }
        return out;
    }

    private async getRoomSkinAssetInfo(fixtureId: number, textureId: number, kind: "floor" | "wall"): Promise<RoomSkinAssetInfo | null> {
        const meta = this.fixtureMetaMap.get(fixtureId);
        const asset = meta?.assetbundleName;
        if (!asset) return null;
        if (kind === "floor") {
            const floorTex = this.pickRoomSkinTextureUrl(asset, textureId, "floor");
            return { asset, floorTexUrl: floorTex || undefined, doorObjUrls: [] };
        }
        const wallTex = this.pickRoomSkinTextureUrl(asset, textureId, "wall");
        const doorTex = this.pickRoomSkinTextureUrl(asset, textureId, "door");
        const doorObjUrls = this.pickRoomSkinObjectUrls(asset);
        return { asset, wallTexUrl: wallTex || undefined, doorTexUrl: doorTex || undefined, doorObjUrls };
    }

    private pickRoomSkinTextureUrl(assetName: string, textureId: number, kind: "floor" | "wall" | "door"): string | null {
        const path = kind === "floor"
            ? getRoomSkinFloorTexturePath(assetName, textureId)
            : kind === "wall"
                ? getRoomSkinWallTexturePath(assetName, textureId)
                : getRoomSkinDoorTexturePath(assetName, textureId);
        return getMysekaiCandidateRawUrls(path, this.options.assetSource)[0] || null;
    }

    private pickRoomSkinObjectUrls(assetName: string): string[] {
        return getRoomSkinDoorObjectPaths(assetName).flatMap((path) => getMysekaiCandidateRawUrls(path, this.options.assetSource));
    }

    private createIndoorWalls(size: MysekaiSceneSize) {
        const halfW = size.width / 2;
        const halfD = size.depth / 2;
        const height = Number(size.height || 12);
        const wallDefs: Array<{
            type: string;
            width: number;
            position: [number, number, number];
            rotation: [number, number, number];
        }> = [
            { type: "wall_back", width: size.width, position: [0, height / 2, -halfD], rotation: [0, 0, 0] },
            { type: "wall_front", width: size.width, position: [0, height / 2, halfD], rotation: [0, Math.PI, 0] },
            { type: "wall_left", width: size.depth, position: [-halfW, height / 2, 0], rotation: [0, Math.PI / 2, 0] },
            { type: "wall_right", width: size.depth, position: [halfW, height / 2, 0], rotation: [0, -Math.PI / 2, 0] },
        ];
        for (const def of wallDefs) {
            const wall = new THREE.Mesh(
                new THREE.PlaneGeometry(1, 1),
                new THREE.MeshLambertMaterial({ color: 0xd0d0d0, side: THREE.DoubleSide, transparent: true, opacity: this.options.backWallOpacity }),
            );
            wall.scale.set(def.width, height, 1);
            wall.position.set(...def.position);
            wall.rotation.set(...def.rotation);
            wall.userData.wallType = def.type;
            this.indoorWallPlanes.push(wall);
            this.scene.add(wall);
        }
    }

    private applyIndoorFloorUV(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4, siteSize: MysekaiSceneSize) {
        const period = 28;
        const halfW = Number(siteSize.width || 80) / 2;
        const halfD = Number(siteSize.depth || 80) / 2;
        const position = geometry.attributes.position;
        const uv = new Float32Array(position.count * 2);
        const vector = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
            vector.fromBufferAttribute(position, i).applyMatrix4(worldMatrix);
            const gx = vector.x + halfW;
            const gz = vector.z + halfD;
            uv[i * 2] = -modPos(gx + 2, period) / period;
            uv[i * 2 + 1] = modPos(gz + 4, period) / period;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    private applyOutdoorFloorUV(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4, siteSize: MysekaiSceneSize) {
        const period = 8;
        const halfW = Number(siteSize.width || 80) / 2;
        const halfD = Number(siteSize.depth || 80) / 2;
        const position = geometry.attributes.position;
        const uv = new Float32Array(position.count * 2);
        const vector = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
            vector.fromBufferAttribute(position, i).applyMatrix4(worldMatrix);
            uv[i * 2] = (vector.x + halfW) / period;
            uv[i * 2 + 1] = (vector.z + halfD) / period;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    private applyIndoorWallUV(wall: THREE.Mesh) {
        const geometry = wall.geometry;
        const position = geometry.attributes.position;
        const uv = new Float32Array(position.count * 2);
        const wallWidth = Number(wall.scale.x || 1);
        const wallHeight = Number(wall.scale.y || 1);
        const wallType = String(wall.userData.wallType || "");
        const isLeftRight = wallType === "wall_left" || wallType === "wall_right";
        for (let i = 0; i < position.count; i++) {
            const lx = position.getX(i);
            const ly = position.getY(i);
            const alongBase = (lx + 0.5) * wallWidth;
            const along = isLeftRight ? alongBase + 2 : wallWidth - alongBase;
            let up = ly + 0.5;
            if (isLeftRight) up += 1.2;
            up *= wallHeight;
            uv[i * 2] = (along + 0.375) / 24.75;
            uv[i * 2 + 1] = 0.5 + (((up + 1.15) / 12) * 0.5);
            if (!isLeftRight) uv[i * 2] = -uv[i * 2];
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    private applyRoadWorldUV(geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4) {
        const position = geometry.attributes.position;
        const uv = new Float32Array(position.count * 2);
        const vector = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
            vector.fromBufferAttribute(position, i).applyMatrix4(worldMatrix);
            uv[i * 2] = vector.x * 0.5;
            uv[i * 2 + 1] = vector.z * 0.5;
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    private makeGrid(size: MysekaiSceneSize) {
        this.clearGrid();
        const maxSize = Math.max(size.width, size.depth);
        this.gridMinor = new THREE.GridHelper(maxSize, maxSize, 0x9bc3ff, 0x9bc3ff);
        this.gridMinor.material.transparent = true;
        this.gridMinor.material.opacity = 0.2;
        this.gridMinor.position.y = 0.01;
        this.gridMajor = new THREE.GridHelper(maxSize, Math.max(1, Math.floor(maxSize / 4)), 0xffffff, 0xffffff);
        this.gridMajor.material.transparent = true;
        this.gridMajor.material.opacity = 0.35;
        this.gridMajor.position.y = 0.012;
        this.scene.add(this.gridMinor, this.gridMajor);
        this.applyDebugVisibility();
    }

    private createFakeFloorShadowForObject(object: THREE.Object3D, siteSize: MysekaiSceneSize): THREE.Mesh | null {
        const bbox = captureWorldBBox(object);
        const w = Math.max(0.5, bbox.max.x - bbox.min.x);
        const d = Math.max(0.5, bbox.max.z - bbox.min.z);
        if (!(w > 0 && d > 0)) return null;
        const halfW = siteSize.width / 2;
        const halfD = siteSize.depth / 2;
        const xMin = Math.max(-halfW, bbox.min.x);
        const xMax = Math.min(halfW, bbox.max.x);
        const zMin = Math.max(-halfD, bbox.min.z);
        const zMax = Math.min(halfD, bbox.max.z);
        if (xMax <= xMin || zMax <= zMin) return null;
        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.13, depthWrite: false }),
        );
        shadow.rotation.x = -Math.PI * 0.5;
        shadow.scale.set(xMax - xMin, zMax - zMin, 1);
        shadow.position.set((xMin + xMax) / 2, SHADOW_Y_OFFSET, (zMin + zMax) / 2);
        shadow.userData.isFloorShadow = true;
        shadow.visible = this.options.shadowEnabled;
        return shadow;
    }

    private applyFloorStacking(records: FloorPlacementRecord[], customOnly: boolean) {
        if (!records.length) return;
        const ordered = customOnly
            ? [...records.filter((item) => item.customPartType === "base"), ...records.filter((item) => item.customPartType === "ornament")]
            : [...records].sort((a, b) => a.bottomY - b.bottomY);
        const cellMap = new Map<string, FloorPlacementRecord[]>();
        const eps = 0.001;
        for (const record of ordered) {
            let supportTop: number | null = null;
            for (const key of record.cellKeys) {
                const belowList = cellMap.get(key);
                if (!belowList?.length) continue;
                for (const below of belowList) {
                    if (below === record) continue;
                    const isValid = customOnly
                        ? below.customPartType === "base" && record.customPartType === "ornament"
                        : below.topY - eps < record.bottomY && below.customPartType === null;
                    if (!isValid) continue;
                    if (calcBBoxXZAreaOverlayRatio(record.bbox, below.bbox) < 0.8) continue;
                    if (supportTop === null || below.topY > supportTop) supportTop = below.topY;
                }
                break;
            }
            if (supportTop !== null && (customOnly || supportTop <= record.bottomY)) {
                const dy = supportTop - record.bottomY;
                record.object.position.y += dy;
                record.bbox = captureWorldBBox(record.object);
                record.bottomY = record.bbox.min.y;
                record.topY = record.bbox.max.y;
            }
            for (const key of record.cellKeys) {
                const list = cellMap.get(key) || [];
                list.push(record);
                cellMap.set(key, list);
            }
        }
    }

    private async buildScene(forceFreshLayout: boolean) {
        this.clearBeforeBuild();
        this.setStatus({
            phase: "loading",
            stage: "layout",
            stageLabel: "正在读取布局",
            progress: 8,
            message: "加载 layout...",
            loaded: 0,
            total: 0,
            skipped: 0,
            ignored: 0,
            failed: 0,
        });
        const layout = await this.fetchJson<MysekaiLayoutData | MysekaiLayoutData[]>([this.options.layoutUrl], this.options.layoutUrl, forceFreshLayout);
        const siteId = Number(this.options.siteId || 1);
        const { entries, playerRank } = this.extractEntries(layout, siteId);
        const ignoredEntries = entries.filter((entry) => this.getIgnoredReason(entry));
        const renderEntries = entries.filter((entry) => !this.getIgnoredReason(entry));
        const siteLevelId = this.getSiteLevelIdByRank(playerRank, siteId);
        const siteSize = this.getSiteSize(siteLevelId);
        const gateId = Array.isArray(layout) ? 1 : Number(layout.userMysekaiGate?.mysekaiGateId || 1);
        const floorPlacementRecords: FloorPlacementRecord[] = [];
        const floorShadowRecords: FloorShadowRecord[] = [];
        let loaded = 0;
        let failed = 0;
        const ignored = ignoredEntries.length;

        this.mergeStatus({
            stage: "assets",
            stageLabel: "正在加载模型资源",
            progress: 12,
            message: `加载中... 0/${renderEntries.length}`,
            loaded,
            total: entries.length,
            renderableTotal: renderEntries.length,
            skipped: failed,
            ignored,
            failed,
        });

        for (const { layoutType, item } of renderEntries) {
            try {
                const entryGroup = await this.buildEntry(layoutType, item, siteSize, gateId, floorPlacementRecords, floorShadowRecords);
                if (entryGroup.children.length) {
                    this.contentGroup.add(entryGroup);
                    loaded++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
                console.warn("[mysekai-preview-skip]", { layoutType, item, error: errorMessage(error) });
            }
            const processed = loaded + failed;
            if (processed % 10 === 0 || processed === renderEntries.length) {
                const progress = 12 + Math.round((processed / Math.max(1, renderEntries.length)) * 76);
                this.mergeStatus({
                    message: `加载中... ${processed}/${renderEntries.length}`,
                    loaded,
                    total: entries.length,
                    renderableTotal: renderEntries.length,
                    skipped: failed,
                    ignored,
                    failed,
                    progress,
                });
            }
        }

        this.mergeStatus({ stage: "finalize", stageLabel: "正在整理场景", progress: 92, loaded, total: entries.length, renderableTotal: renderEntries.length, skipped: failed, ignored, failed });
        this.applyFloorStacking(floorPlacementRecords, false);
        this.applyFloorStacking(floorPlacementRecords, true);
        for (const record of floorShadowRecords) {
            const bbox = captureWorldBBox(record.object);
            if (Math.abs(bbox.min.y) > 0.06) this.contentGroup.remove(record.shadow);
        }
        this.applyShadowVisibility();

        await this.buildBaseSurface(layout, siteId, siteSize);
        this.makeGrid(siteSize);
        this.applyDebugVisibility();
        this.applyBackWallOpacity();

        if (!this.restoredCameraState) {
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(siteSize.width * 0.75, Math.max(25, siteSize.depth * 0.55), siteSize.depth * 0.75);
        }
        this.controls.update();
        this.setStatus({
            phase: "ready",
            stage: "ready",
            stageLabel: "加载完成",
            progress: 100,
            message: `完成: ${loaded}/${renderEntries.length} 个可渲染实例\n正常忽略: ${ignored}　加载失败: ${failed}\nsiteId=${siteId}, rank=${playerRank}, siteLevelId=${siteLevelId ?? "默认"}, size=${siteSize.width}x${siteSize.depth}`,
            loaded,
            total: entries.length,
            renderableTotal: renderEntries.length,
            skipped: failed,
            ignored,
            failed,
        });
    }

    private async buildEntry(
        layoutType: string,
        item: MysekaiLayoutItem,
        siteSize: MysekaiSceneSize,
        gateId: number,
        floorPlacementRecords: FloorPlacementRecord[],
        floorShadowRecords: FloorShadowRecord[],
    ): Promise<THREE.Group> {
        const entryGroup = new THREE.Group();
        const isCustom = !!item.__isCustomFixture;
        const fixtureId = Number(item.mysekaiFixtureId);
        const customFixtureId = Number(item.mysekaiCustomFixtureId);
        const meta = isCustom ? null : this.fixtureMetaMap.get(fixtureId);
        const customMeta = isCustom ? this.customFixtureMetaMap.get(customFixtureId) : null;
        if (!isCustom && meta?.mysekaiFixtureHandleType === "block_transparent") return entryGroup;

        const renderAssets: FixtureRenderAsset[] = [];
        if (isCustom) {
            if (!customMeta) return entryGroup;
            if (customMeta.baseAssetBundleName) renderAssets.push({ asset: customMeta.baseAssetBundleName, isOrnament: false, useCustomAttachRoot: false });
            if (customMeta.ornamentAssetBundleName) renderAssets.push({ asset: customMeta.ornamentAssetBundleName, isOrnament: true, useCustomAttachRoot: true });
        } else {
            const asset = fixtureId === 900002 ? GATE_ASSET_BY_ID[gateId] : meta?.assetbundleName;
            if (!asset) return entryGroup;
            renderAssets.push({ asset, isOrnament: false, useCustomAttachRoot: false });
        }

        const position = this.mapWallLayoutToScenePos(layoutType, item.position || { x: 0, y: 0, z: 0 }, siteSize);
        let epsY = 0;
        if (layoutType === "road") epsY = 0.01;
        else if (layoutType === "rug") epsY = 0.02;
        else if (layoutType === "floor") epsY = 0.03;

        const baseGridW = isCustom ? Number(customMeta?.width || 1) : Number(meta?.gridSize?.width || 1);
        const baseGridD = isCustom ? Number(customMeta?.depth || 1) : Number(meta?.gridSize?.depth || 1);
        const baseGridH = isCustom ? Number(customMeta?.height || 1) : Number(meta?.gridSize?.height || 1);
        const baseRotY = mapLayoutToSceneRotDeg(item.rotation || 0) * Math.PI / 180;
        const customRoot = isCustom ? new THREE.Group() : null;
        const customStackParts: THREE.Object3D[] = [];
        let placedForShadow: THREE.Object3D | null = null;

        for (const assetInfo of renderAssets) {
            const objUrls = this.getObjCandidateUrls(assetInfo.asset, assetInfo.useCustomAttachRoot, meta?.mysekaiFixtureHandleType, meta?.mysekaiFixtureType);
            const primaryObjUrl = await this.pickPrimaryObjUrl(objUrls);
            if (!primaryObjUrl) throw new Error(`模型缺失: ${assetInfo.asset}`);
            const srcObject = await this.getObjGroup(primaryObjUrl);
            const texture = await this.getFixtureTexture(assetInfo.asset, Number(item.textureId || 1), assetInfo.useCustomAttachRoot, meta?.mysekaiFixtureHandleType);
            const makeMaterial = () => new THREE.MeshLambertMaterial({
                map: texture || null,
                color: 0xffffff,
                side: THREE.FrontSide,
                transparent: layoutType !== "road",
                alphaTest: layoutType === "road" ? 0 : 0.5,
                polygonOffset: layoutType === "road",
                polygonOffsetFactor: layoutType === "road" ? -1 : 0,
                polygonOffsetUnits: layoutType === "road" ? -1 : 0,
            });

            let object: THREE.Object3D;
            if (!isCustom && fixtureId >= 439 && fixtureId <= 444) {
                object = this.cloneCanvasWithCardMaterial(srcObject, makeMaterial, await this.getCanvasCardTexture(item), fixtureId);
            } else if (isCustom) {
                const displayTexture = customFixtureId === 55 && assetInfo.isOrnament
                    ? await this.getRecordJacketTexture(item)
                    : this.createFallbackTexture();
                object = this.cloneCustomWithDisplayTexture(srcObject, makeMaterial, displayTexture);
            } else {
                object = this.cloneWithMaterial(srcObject, makeMaterial);
            }

            applyDollFixtureSizeCorrection(object, assetInfo.asset);
            let rotY = baseRotY;
            if (isCustom && assetInfo.isOrnament) rotY += mapLayoutToSceneRotDeg(item.ornamentRotation || 0) * Math.PI / 180;
            const placed = locateObject(object, position.x, position.z, position.y + epsY, baseGridW, baseGridD, baseGridH, rotY, layoutType);
            if (isCustom) {
                placed.traverse((node) => {
                    if (!isMesh(node)) return;
                    if (String(node.name || "").toLowerCase().includes("preview")) node.visible = false;
                });
            }
            if (layoutType === "road") {
                placed.traverse((node) => {
                    if (!isMesh(node)) return;
                    this.applyRoadWorldUV(node.geometry, node.matrixWorld);
                });
            }
            if (isCustom && customRoot) {
                placed.userData.isCustomPart = true;
                placed.userData.customPartType = assetInfo.isOrnament ? "ornament" : "base";
                customRoot.add(placed);
                customStackParts.push(placed);
            } else {
                entryGroup.add(placed);
                placedForShadow ||= placed;
            }
        }

        if (isCustom && customRoot && customRoot.children.length) {
            entryGroup.add(customRoot);
            placedForShadow = customRoot;
        }

        if (layoutType === "floor") {
            const stackObjects = isCustom ? customStackParts : placedForShadow ? [placedForShadow] : [];
            for (const stackObject of stackObjects) {
                const bbox = captureWorldBBox(stackObject);
                floorPlacementRecords.push({
                    object: stackObject,
                    bbox,
                    bottomY: bbox.min.y,
                    topY: bbox.max.y,
                    cellKeys: getXZCellKeysFromBBox(bbox),
                    customPartType: String(stackObject.userData.customPartType || "") || null,
                });
            }
            if (placedForShadow && Math.abs(Number(item.position?.y || 0)) < 1e-6) {
                const shadow = this.createFakeFloorShadowForObject(placedForShadow, siteSize);
                if (shadow) {
                    entryGroup.add(shadow);
                    floorShadowRecords.push({ object: placedForShadow, shadow });
                }
            }
        }

        return entryGroup;
    }

    private async buildBaseSurface(layout: MysekaiLayoutData | MysekaiLayoutData[], siteId: number, siteSize: MysekaiSceneSize) {
        this.applyLightingPreset(siteId === 1);
        this.grass.scale.set(siteSize.width, siteSize.depth, 1);
        this.grass.position.set(0, 0, 0);
        this.grass.visible = true;
        if (siteId === 1) {
            const outdoorTexture = await this.getTextureFromUrls(getMysekaiCandidateRawUrls(getOutdoorGrassTexturePath(), this.options.assetSource));
            if (outdoorTexture) {
                outdoorTexture.wrapS = outdoorTexture.wrapT = THREE.RepeatWrapping;
                this.grass.material.map = outdoorTexture;
                this.grass.material.color.set(0xffffff);
                this.grass.material.needsUpdate = true;
                this.grass.updateMatrixWorld(true);
                this.applyOutdoorFloorUV(this.grass.geometry, this.grass.matrixWorld, siteSize);
            }
            return;
        }

        this.createIndoorWalls(siteSize);
        const appearance = this.getIndoorSurfaceAppearance(layout, siteId);
        const floorSkin = appearance.floor?.mysekaiFixtureId
            ? await this.getRoomSkinAssetInfo(Number(appearance.floor.mysekaiFixtureId), Number(appearance.floor.textureId || 1), "floor")
            : null;
        const wallSkin = appearance.wall?.mysekaiFixtureId
            ? await this.getRoomSkinAssetInfo(Number(appearance.wall.mysekaiFixtureId), Number(appearance.wall.textureId || 1), "wall")
            : null;

        if (floorSkin?.floorTexUrl) {
            const floorTexture = await this.getTextureFromUrls([floorSkin.floorTexUrl]);
            if (floorTexture) {
                floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
                this.grass.material.map = floorTexture;
                this.grass.material.color.set(0xffffff);
                this.grass.material.needsUpdate = true;
                this.grass.updateMatrixWorld(true);
                this.applyIndoorFloorUV(this.grass.geometry, this.grass.matrixWorld, siteSize);
            }
        }

        if (wallSkin?.wallTexUrl) {
            const wallTexture = await this.getTextureFromUrls([wallSkin.wallTexUrl]);
            if (wallTexture) {
                wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
                for (const wall of this.indoorWallPlanes) {
                    const material = wall.material as THREE.MeshLambertMaterial;
                    material.map = wallTexture;
                    material.color.set(0xffffff);
                    material.needsUpdate = true;
                    this.applyIndoorWallUV(wall);
                }
            }
        }

        if (wallSkin?.doorObjUrls.length) {
            const doorObjUrl = await this.pickPrimaryObjUrl(wallSkin.doorObjUrls);
            if (doorObjUrl) {
                const doorTexture = wallSkin.doorTexUrl ? await this.getTextureFromUrls([wallSkin.doorTexUrl]) : null;
                const srcDoor = await this.getObjGroup(doorObjUrl);
                const door = this.cloneWithMaterial(srcDoor, () => new THREE.MeshLambertMaterial({
                    map: doorTexture,
                    color: 0xffffff,
                    side: THREE.FrontSide,
                    transparent: true,
                    alphaTest: 0.5,
                }));
                const halfW = siteSize.width / 2;
                const halfD = siteSize.depth / 2;
                const placed = locateObject(door, halfW - 2, halfD - 0.01, 0, 4, 1, 5, 0, "wall_front");
                this.contentGroup.add(placed);
                this.indoorDoorObject = placed;
            }
        }
    }

    private applyDebugVisibility() {
        const gridVisible = this.options.gridEnabled;
        if (this.gridMinor) this.gridMinor.visible = gridVisible;
        if (this.gridMajor) this.gridMajor.visible = gridVisible;
        this.scene.traverse((node) => {
            if (node.userData.debugOnly) node.visible = this.options.debugEnabled;
        });
    }

    private applyShadowVisibility() {
        this.contentGroup.traverse((node) => {
            if (node.userData.isFloorShadow) node.visible = this.options.shadowEnabled;
        });
    }

    private applyBackWallOpacity() {
        for (const wall of this.indoorWallPlanes) {
            const material = wall.material as THREE.MeshLambertMaterial;
            material.opacity = this.options.backWallOpacity;
            material.transparent = true;
            material.needsUpdate = true;
        }
    }

    private handleResize = () => {
        const width = Math.max(this.container.clientWidth || 1, 1);
        const height = Math.max(this.container.clientHeight || 1, 1);
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        const axesWidth = Math.max(this.axesContainer.clientWidth || 1, 1);
        const axesHeight = Math.max(this.axesContainer.clientHeight || 1, 1);
        this.axesRenderer.setSize(axesWidth, axesHeight);
        this.axesCamera.aspect = axesWidth / axesHeight;
        this.axesCamera.updateProjectionMatrix();
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        const key = String(event.key || "").toLowerCase();
        if (key === "w" || key === "s" || key === "a" || key === "d") this.keyState[key] = true;
        if (event.code === "Space") this.keyState.space = true;
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.keyState.shift = true;
    };

    private handleKeyUp = (event: KeyboardEvent) => {
        const key = String(event.key || "").toLowerCase();
        if (key === "w" || key === "s" || key === "a" || key === "d") this.keyState[key] = false;
        if (event.code === "Space") this.keyState.space = false;
        if (event.code === "ShiftLeft" || event.code === "ShiftRight") this.keyState.shift = false;
    };

    private moveCameraRig(offset: THREE.Vector3) {
        this.camera.position.add(offset);
        this.controls.target.add(offset);
        this.controls.update();
    }

    private tick = () => {
        if (this.disposed) return;
        const moveSpeed = 0.35;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 1e-8) forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
        const offset = new THREE.Vector3();
        if (this.keyState.w) offset.addScaledVector(forward, moveSpeed);
        if (this.keyState.s) offset.addScaledVector(forward, -moveSpeed);
        if (this.keyState.d) offset.addScaledVector(right, moveSpeed);
        if (this.keyState.a) offset.addScaledVector(right, -moveSpeed);
        if (this.keyState.space) offset.y += moveSpeed;
        if (this.keyState.shift) offset.y -= moveSpeed;
        if (offset.lengthSq() > 0) this.moveCameraRig(offset);

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.axesCamera.position.copy(direction.clone().multiplyScalar(-2.5));
        this.axesCamera.up.copy(this.camera.up);
        this.axesCamera.lookAt(0, 0, 0);
        this.axesRenderer.render(this.axesScene, this.axesCamera);
        this.rafId = requestAnimationFrame(this.tick);
    };

    private saveCameraState = () => {
        try {
            const state = {
                cameraPos: this.camera.position.toArray(),
                controlsTarget: this.controls.target.toArray(),
                cameraUp: this.camera.up.toArray(),
            };
            localStorage.setItem("mysekai-preview-camera", JSON.stringify(state));
        } catch {
            // ignore localStorage failures
        }
    };

    private loadCameraState() {
        try {
            const raw = localStorage.getItem("mysekai-preview-camera");
            if (!raw) return;
            const state = JSON.parse(raw) as { cameraPos?: number[]; controlsTarget?: number[]; cameraUp?: number[] };
            if (state.cameraPos?.length === 3 && state.controlsTarget?.length === 3) {
                this.camera.position.fromArray(state.cameraPos);
                this.controls.target.fromArray(state.controlsTarget);
                if (state.cameraUp?.length === 3) this.camera.up.fromArray(state.cameraUp);
                this.controls.update();
                this.restoredCameraState = true;
            }
        } catch {
            // ignore corrupted camera state
        }
    }
}
