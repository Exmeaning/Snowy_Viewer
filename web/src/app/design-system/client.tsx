"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

import MainLayout from "@/components/MainLayout";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import Modal from "@/components/common/Modal";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import { CursorRing, HandheldMark, HandheldEmptyState } from "@/components/handheld";
import { useHandheldCursor } from "@/hooks/useHandheldCursor";
import { useQuickFilter } from "@/contexts/QuickFilterContext";
import { useTheme } from "@/contexts/ThemeContext";
import { playHandheldSound, type HandheldSoundName } from "@/lib/handheld-sound";
import type { ICardInfo } from "@/types/types";

/**
 * Handheld OS — living system reference.
 *
 * This route is the front door of the design system, so it is held to a rule the
 * rest of the app is only asked to follow: every surface below is built from the
 * same hh vocabulary it documents. A reference page rendered in the vocabulary it
 * replaced is worse than no reference page, because it teaches the wrong thing to
 * whoever reads it first.
 *
 * Copy here is deliberately hardcoded English rather than routed through the i18n
 * dictionaries. This is a developer-only, noindex route documenting CSS class
 * names and token identifiers that are themselves English and untranslatable, and
 * scripts/scan-hardcoded-ui-text.mjs allowlists it for exactly that reason.
 * Translating "border-color follows --hh-border" into three locales would triple
 * the dictionary for zero reader benefit.
 */

const MysekaiScenePreview = dynamic(() => import("@/components/mysekai-preview/MysekaiScenePreview"), {
    // Kept ssr:false: the previewer touches WebGL at module scope.
    ssr: false,
    loading: () => (
        <div className="hh-well flex h-[560px] items-center justify-center text-[var(--hh-text-tertiary)]">
            <span className="hh-spinner mr-3 h-5 w-5" />
            Loading scene previewer...
        </div>
    ),
});

/* ──────────────────────────────────────────────────────────────────────────
   Shared local class recipes
   ────────────────────────────────────────────────────────────────────────── */

/** Inline identifier — token names, class names, file paths. */
const CODE_CLASS =
    "rounded-[var(--hh-radius-xs)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] " +
    "px-1.5 py-0.5 font-mono text-[0.72rem] text-[var(--hh-text-primary)]";

/** Demo action button. Padding stays at the call site so each row can size itself. */
const DEMO_BTN_CLASS = "hh-btn hh-press hh-focusable text-sm";

/* ──────────────────────────────────────────────────────────────────────────
   Token data
   ────────────────────────────────────────────────────────────────────────── */

interface TokenEntry {
    readonly name: string;
    readonly value: string;
    readonly note: string;
}

/**
 * The surface ramp is the load-bearing idea of the whole system: depth comes from
 * lightness steps between opaque fills, never from translucency. Listing the rungs
 * next to each other is the only way to see that the steps are even.
 */
const SURFACE_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-surface-base", value: "canvas / ground", note: "The room ground. Single base level, always darker than the cards on it." },
    { name: "--hh-surface-1", value: "panel / chassis", note: "Outer shell, drawer frame, navigation rail, and container backplates." },
    { name: "--hh-surface-2", value: "tile / card", note: "Default floating item. Cards, modals, dialogs, buttons, inputs." },
    { name: "--hh-surface-3", value: "raised / hover", note: "Elevated popovers, active hover layer, and selected item surface." },
    { name: "--hh-surface-sunken", value: "well / trough", note: "Recessed wells, search troughs, chip wells, and empty states." },
    { name: "--hh-surface-inset", value: "deep channel", note: "Deepest level. Slider tracks, meter wells, input insets." },
];

const BORDER_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-border", value: "default ring", note: "The 1px outline every tile, panel and control wears." },
    { name: "--hh-border-strong", value: "emphasis", note: "Hover borders and switch troughs, where the ring must read as hardware." },
    { name: "--hh-border-hairline", value: "separator", note: "Alpha-based. Rows inside a container, where a full border would double up." },
];

const TEXT_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-text-primary", value: "body + headings", note: "Never lighter than weight 400 at body size." },
    { name: "--hh-text-secondary", value: "supporting copy", note: "Descriptions, inactive segments, metadata." },
    { name: "--hh-text-tertiary", value: "placeholder", note: "Placeholders, uppercase labels, disabled text." },
    { name: "--hh-text-on-accent", value: "on accent fill", note: "The only correct foreground on an accent-filled slab." },
];

const ACCENT_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-accent", value: "follows theme", note: "Inherits --color-miku, so all 26 character themes drive it." },
    { name: "--hh-accent-deep", value: "follows theme", note: "Darker pair for text on a light surface, where the raw accent fails contrast." },
    { name: "--hh-accent-wash", value: "12% mix", note: "Mixed into the surface, not layered at low alpha. Survives the theme flip." },
    { name: "--hh-accent-wash-strong", value: "20% mix", note: "Same idea, one step louder. Selected rows, active wells." },
    { name: "--hh-accent-line", value: "55% alpha", note: "Accent-tinted border for a hovered or selected container." },
    { name: "--hh-accent-alert", value: "fixed", note: "Destructive actions. Deliberately does NOT follow the character theme." },
];

interface RadiusEntry {
    readonly name: string;
    readonly px: string;
    readonly use: string;
}

/**
 * Which rung a component picks is a statement about what kind of object it is, so
 * the picking rule is documented alongside the value. Everything the user presses
 * sits one rung below the tile it lives on.
 */
const RADIUS_LADDER: readonly RadiusEntry[] = [
    { name: "--hh-radius-xs", px: "3px", use: "Inline code, micro badges." },
    { name: "--hh-radius-sm", px: "5px", use: "Segment items, keycaps, badges on media. One rung under a control." },
    { name: "--hh-radius-md", px: "8px", use: "The interactive tonic: buttons, inputs, chips, nav rows." },
    { name: "--hh-radius-lg", px: "12px", use: "Tiles and wells — the object rung." },
    { name: "--hh-radius-xl", px: "16px", use: "Panels and floating layers — structural chrome." },
    { name: "--hh-radius-2xl", px: "20px", use: "Full-bleed sheets and the largest containers only." },
    { name: "--hh-radius-full", px: "999px", use: "Reserved for genuinely round things: switches, dock icons, avatars." },
];

const SHADOW_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-shadow-tile", value: "resting", note: "Barely there. A tile hovers a hair above the room, nothing more." },
    { name: "--hh-shadow-raised", value: "hover / panel", note: "Panels at rest, tiles under the cursor." },
    { name: "--hh-shadow-float", value: "overlay", note: "Dropdowns, popovers, dialogs. The only large blur radius in the system." },
    { name: "--hh-shadow-inset", value: "trough", note: "Inward. Marks a channel cut into the surface." },
];

const MOTION_TOKENS: readonly TokenEntry[] = [
    { name: "--hh-dur-press", value: "90ms", note: "Press acknowledgment. Must beat conscious perception." },
    { name: "--hh-dur-fast", value: "160ms", note: "Hover, tint, small state changes." },
    { name: "--hh-dur-cursor", value: "220ms", note: "Cursor travel and interactive overshoot." },
    { name: "--hh-dur-screen", value: "240ms", note: "Route and screen changes. Damped." },
    { name: "--hh-dur-panel", value: "300ms", note: "Sheets and large panels. Damped. Nothing in the system is slower." },
    { name: "--hh-ease-spring", value: "cubic-bezier(.34,1.56,.64,1)", note: "Snappy spring response with micro overshoot." },
    { name: "--hh-ease-cursor", value: "cubic-bezier(.34,1.56,.64,1)", note: "Cursor travel and interactive springs." },
    { name: "--hh-ease-out", value: "cubic-bezier(.22,1,.36,1)", note: "The structural default. Arrives, never wobbles." },
    { name: "--hh-ease-snap", value: "cubic-bezier(.34,1.56,.64,1)", note: "Press & snap transforms." },
    { name: "--hh-press-scale", value: "0.965", note: "How far a pressed control sinks." },
    { name: "--hh-select-scale", value: "1.045", note: "How far the tile under the cursor lifts." },
];

/* ──────────────────────────────────────────────────────────────────────────
   Architecture pitfalls
   ────────────────────────────────────────────────────────────────────────── */

interface Pitfall {
    readonly title: string;
    readonly symptom: string;
    readonly rule: string;
    readonly critical: boolean;
}

/**
 * Every entry here cost at least one batch of the migration to discover, and most
 * of them fail SILENTLY — they compile, they pass lint, they pass tsc, and then do
 * nothing at runtime. That is the whole reason this section exists rather than
 * living in a commit message nobody will read again.
 */
const PITFALLS: readonly Pitfall[] = [
    {
        title: "Cascade layers are not uniform across the stylesheet",
        symptom:
            "A utility written next to an hh class sometimes wins and sometimes does nothing, with no pattern visible from the call site.",
        rule:
            "The hh primitives live in @layer components, which the framework orders BEFORE utilities — so they are defaults and your utility wins. Four groups stay deliberately unlayered because they must DEFEAT utilities: the legacy vocabulary re-skin (it has to beat glassmorphism-era utilities still written at those call sites), the blur neutralization, focus rings and selection state (losing a focus ring is an accessibility defect, not a preference), and the transition on .hh-press (46 call sites also write transition-colors, which would otherwise drop transform and kill the 90ms press). Do not finish the job by wrapping those.",
        critical: true,
    },
    {
        title: ".hh-segment fills its container by default",
        symptom:
            "Dropped into a page header row, the control eats every spare pixel and shoves the title and actions to the edges.",
        rule:
            "The default is width:100% plus flex:1 1 auto, which is correct in the side rail and wrong everywhere else. Add .hh-segment-fit to shrink to content. Do not hand-write w-auto grow-0 shrink-0 — three call sites already did that independently, which is what earned the variant its name.",
        critical: false,
    },
    {
        title: "Blur utilities are globally neutralized",
        symptom: "You write a blur utility, it compiles, and the surface renders perfectly sharp.",
        rule:
            "A global rule cancels backdrop-filter on anything whose class list contains a blur utility. That is intentional: those ~120 live compositor blurs were the scroll cost this redesign set out to remove. Where blur is FUNCTIONAL rather than decorative — spoiler shields, obscuring veils — opt the element or its subtree back in with .hh-allow-blur. Modal scrims are not such a case; they belong on the flat .hh-scrim.",
        critical: true,
    },
    {
        title: "Numbers need tabular figures",
        symptom:
            "Leaderboard ranks, timers and score deltas jitter horizontally as they tick, and columns fail to line up.",
        rule:
            "Put .hh-numeric on any element containing a number that changes or that sits in a column. Use .hh-numeric-slashed only for alphanumeric identifiers where 0-vs-O is genuinely ambiguous — asset paths, bundle names, hashes — never for plain digit runs.",
        critical: false,
    },
    {
        title: "Overshoot is a privilege, not a default",
        symptom: "Everything springs, and the UI reads as toy-like and slower than it is.",
        rule:
            "Exactly one thing may overshoot: the selection cursor. Screens, panels, sheets and rails are critically damped (bounce: 0). Import the presets from lib/motion rather than hand-writing spring configs; the one legitimate exception is momentum handoff after a flick, where the user's own gesture supplied the energy.",
        critical: false,
    },
    {
        title: "Never branch variants on a reduced-motion hook during render",
        symptom:
            "Hydration mismatch warnings, and a first paint that disagrees with the client.",
        rule:
            "The server cannot know the user's motion preference, so reading it during render produces different markup on each side. The app has zero of these left and should stay at zero. Degradation is handled globally by the MotionConfig wrapper in layout, plus the prefers-reduced-motion block in CSS.",
        critical: true,
    },
    {
        title: "Skeuomorphic lift is retired",
        symptom:
            "A card floats upward on hover, scales up, or gains a colored glow — the vocabulary of the previous design.",
        rule:
            "No hover:-translate-y-*, no hover:scale-105, no colored shadow-miku/* halos. A console surface responds by brightening one surface rung and, under the cursor, by taking the ring. Presses sink inward via .hh-press. Motion in, not motion up.",
        critical: false,
    },
];

/* ──────────────────────────────────────────────────────────────────────────
   Sound
   ────────────────────────────────────────────────────────────────────────── */

interface SoundEntry {
    readonly name: HandheldSoundName;
    readonly meaning: string;
    readonly when: string;
}

const SOUND_CATALOG: readonly SoundEntry[] = [
    { name: "cursor", meaning: "Something moved.", when: "Cursor steps between targets. The most frequent sound, so the quietest and shortest." },
    { name: "confirm", meaning: "Yes, taken.", when: "Selecting an entry, applying a filter, committing a dialog. Two notes stepping up." },
    { name: "back", meaning: "Undone, dismissed.", when: "Closing a sheet, cancelling, navigating up. The confirm gesture inverted." },
    { name: "toggle", meaning: "State flipped.", when: "Binary switches and checkboxes. Deliberately neutral so it fits both on and off." },
    { name: "error", meaning: "Blocked.", when: "A rejected action or failed validation. Low and dull, never sharp." },
    { name: "launch", meaning: "Entering.", when: "Route change or opening a large surface. A rising sweep." },
];

/* ──────────────────────────────────────────────────────────────────────────
   Demo data
   ────────────────────────────────────────────────────────────────────────── */

type DemoCardSeed = Pick<ICardInfo, "id" | "characterId" | "cardRarityType" | "attr" | "prefix" | "assetbundleName">;

/**
 * Fills in the ~15 fields the thumbnail never reads. Written as a factory rather
 * than five inline literals because the noise-to-signal ratio of the literal form
 * hid the four fields that actually differ between the examples.
 */
function demoCard(seed: DemoCardSeed): ICardInfo {
    return {
        seq: seed.id,
        specialTrainingPower1BonusFixed: 0,
        specialTrainingPower2BonusFixed: 0,
        specialTrainingPower3BonusFixed: 0,
        supportUnit: "none",
        skillId: 1,
        cardSkillName: "Skill",
        gachaPhrase: "Phrase",
        archiveDisplayType: "normal",
        archivePublishedAt: 0,
        cardParameters: { param1: [], param2: [], param3: [] },
        specialTrainingCosts: [],
        masterLessonAchieveResources: [],
        releaseAt: 0,
        cardSupplyId: 0,
        cardSupplyType: "normal",
        ...seed,
    };
}

const THUMBNAIL_SIZES = [48, 64, 96] as const;

function DesignSystemTravelingFocusDemo() {
    const { index: activeIndex, setIndex, getItemProps } = useHandheldCursor({
        count: 4,
        columns: 4,
        loop: true,
        activateOnPointer: true,
        onConfirm: () => {
            playHandheldSound("confirm");
        },
    });

    const demoItems = [
        { title: "CARDS", code: "01", desc: "Member archives" },
        { title: "MUSIC", code: "02", desc: "Track masters" },
        { title: "EVENTS", code: "03", desc: "Active stories" },
        { title: "GACHA", code: "04", desc: "Current banners" },
    ];

    return (
        <div className="hh-tile p-6">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h4 className="hh-title text-sm">Interactive Traveling Cursor Ring Matrix</h4>
                    <p className="hh-body mt-0.5 text-xs text-[var(--hh-text-secondary)]">
                        Use Arrow keys, Gamepad stick/D-pad, or Hover/Touch over tiles below. Watch the single shared <code className="font-mono text-[var(--hh-accent-deep)]">CursorRing</code> spring-travel seamlessly.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <span className="hh-chip text-[10px] font-mono">D-PAD / ARROWS</span>
                    <span className="hh-chip text-[10px] font-mono">HOVER</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {demoItems.map((item, idx) => {
                    const itemProps = getItemProps(idx);
                    const isCurrent = activeIndex === idx;

                    return (
                        <div
                            key={item.code}
                            {...itemProps}
                            onClick={() => setIndex(idx)}
                            className="hh-press relative flex h-28 flex-col justify-between rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] p-3.5 transition-colors duration-160 hover:bg-[var(--hh-surface-2)] cursor-pointer"
                        >
                            {isCurrent && (
                                <CursorRing groupId="ds-traveling-cursor" />
                            )}
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-[var(--hh-accent-deep)]">{item.code}</span>
                                <HandheldMark type="pip" size="sm" tone={isCurrent ? "accent" : "muted"} />
                            </div>
                            <div>
                                <h5 className="font-bold text-sm text-[var(--hh-text-primary)]">{item.title}</h5>
                                <p className="text-[11px] text-[var(--hh-text-secondary)]">{item.desc}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
   Layout helpers
   ────────────────────────────────────────────────────────────────────────── */

function Section({ id, title, blurb, children }: {
    id: string;
    title: string;
    blurb?: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="mb-14 scroll-mt-24">
            <div className="mb-5">
                <h2 className="hh-title flex items-center gap-2.5 text-2xl text-[var(--hh-text-primary)]">
                    <span className="h-6 w-1 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)]" />
                    {title}
                </h2>
                {blurb !== undefined && (
                    <p className="hh-body mt-2 max-w-3xl text-sm text-[var(--hh-text-secondary)]">{blurb}</p>
                )}
            </div>
            {children}
        </section>
    );
}

/**
 * One documented primitive: the live specimen on top, the identifier and the
 * reason to reach for it underneath. Specimen first is deliberate — the name is
 * only meaningful once you have seen what it renders as.
 */
function Spec({ name, purpose, children, wide }: {
    name: string;
    purpose: string;
    children: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={`hh-tile hh-list ${wide === true ? "md:col-span-2" : ""}`}>
            <div className="flex min-h-[104px] items-center justify-center p-5">
                {children}
            </div>
            <div className="bg-[var(--hh-surface-1)] px-5 py-3">
                <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">{name}</code>
                <p className="hh-body mt-1 text-xs text-[var(--hh-text-secondary)]">{purpose}</p>
            </div>
        </div>
    );
}

function TokenTable({ rows }: { rows: readonly TokenEntry[] }) {
    return (
        <div className="hh-tile overflow-hidden">
            <table className="hh-table">
                <thead className="hh-table-head">
                    <tr>
                        <th className="hh-label px-4 py-2.5 text-left">Token</th>
                        <th className="hh-label px-4 py-2.5 text-left">Role</th>
                        <th className="hh-label hidden px-4 py-2.5 text-left sm:table-cell">Why</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} className="hh-table-row">
                            <td className="px-4 py-2.5 align-top">
                                <code className="font-mono text-xs text-[var(--hh-text-primary)]">{row.name}</code>
                            </td>
                            <td className="hh-numeric px-4 py-2.5 align-top text-xs text-[var(--hh-text-secondary)]">
                                {row.value}
                            </td>
                            <td className="hh-body hidden px-4 py-2.5 align-top text-xs text-[var(--hh-text-tertiary)] sm:table-cell">
                                {row.note}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Custom properties are not in React's CSSProperties surface; this is the cast. */
function tintStyle(color: string): React.CSSProperties {
    return { "--hh-tint": color } as React.CSSProperties;
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function DesignSystemClient() {
    const { handheldSoundEnabled } = useTheme();

    const [modalSize, setModalSize] = useState<"sm" | "md" | "lg" | "xl">("md");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Live primitive state.
    const [segmentTab, setSegmentTab] = useState<"overview" | "details">("overview");
    const [switchOn, setSwitchOn] = useState(true);
    const [activeChip, setActiveChip] = useState("all");
    // Remounts the animation demo so an entrance can be replayed on demand;
    // CSS animations only run once per element instance.
    const [replayKey, setReplayKey] = useState(0);

    // ===== Quick Filter demo state =====
    const [demoSearch, setDemoSearch] = useState("");
    const [demoSortBy, setDemoSortBy] = useState("name");
    const [demoSortOrder, setDemoSortOrder] = useState<"asc" | "desc">("desc");
    const [demoCategory, setDemoCategory] = useState("all");
    const [demoToggle, setDemoToggle] = useState(false);

    const demoTotalCount = 128;
    const demoFilteredCount = demoSearch || demoCategory !== "all" || demoToggle ? 42 : 128;

    const demoSortOptions = [
        { id: "name", label: "Name" },
        { id: "date", label: "Date" },
        { id: "level", label: "Level" },
    ];

    const hasActiveFilters = demoSearch !== "" || demoCategory !== "all" || demoToggle || demoSortBy !== "name";

    const resetDemoFilters = () => {
        setDemoSearch("");
        setDemoSortBy("name");
        setDemoSortOrder("desc");
        setDemoCategory("all");
        setDemoToggle(false);
    };

    const quickFilterContent = (
        <BaseFilters
            title="Quick filter demo"
            filteredCount={demoFilteredCount}
            totalCount={demoTotalCount}
            countUnit="items"
            searchQuery={demoSearch}
            onSearchChange={setDemoSearch}
            searchPlaceholder="Search demo entries..."
            sortOptions={demoSortOptions}
            sortBy={demoSortBy}
            sortOrder={demoSortOrder}
            onSortChange={(sortBy, sortOrder) => { setDemoSortBy(sortBy); setDemoSortOrder(sortOrder); }}
            hasActiveFilters={hasActiveFilters}
            onReset={resetDemoFilters}
        >
            <FilterSection label="Category">
                <div className="grid grid-cols-3 gap-2">
                    {["all", "typeA", "typeB"].map(cat => (
                        <FilterButton
                            key={cat}
                            selected={demoCategory === cat}
                            onClick={() => setDemoCategory(cat)}
                        >
                            {cat === "all" ? "All" : cat === "typeA" ? "Kind A" : "Kind B"}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>
            <FilterToggle
                selected={demoToggle}
                onClick={() => setDemoToggle(prev => !prev)}
                label="Completed only"
            />
        </BaseFilters>
    );

    useQuickFilter("Quick filter demo", quickFilterContent, [
        demoSearch, demoSortBy, demoSortOrder, demoCategory, demoToggle,
    ]);

    const openModal = (size: "sm" | "md" | "lg" | "xl") => {
        setModalSize(size);
        setIsModalOpen(true);
    };

    return (
        <MainLayout>
            <div className="container relative mx-auto max-w-6xl px-6 py-12">

                {/* ── Masthead ─────────────────────────────────────────── */}
                <header className="mb-12">
                    <div className="hh-label mb-3 inline-flex items-center gap-2 rounded-[var(--hh-radius-md)] border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] px-3 py-1 text-[var(--hh-accent-deep)]">
                        <span className="h-1.5 w-1.5 rounded-[var(--hh-radius-full)] bg-[var(--hh-accent)]" />
                        Handheld OS Foundations
                    </div>
                    <h1 className="hh-display mb-3 text-4xl text-[var(--hh-text-primary)]">
                        MoeSekai Design System
                    </h1>
                    <p className="hh-body max-w-3xl text-lg text-[var(--hh-text-secondary)]">
                        A console-style handheld system UI, rebuilt as a web design layer. Three properties
                        define it and everything below follows from one of them: surfaces are flat and opaque
                        and separate by lightness alone; one selection cursor travels between targets instead of
                        each target lighting up on its own; and presses snap in 90ms while structure settles
                        without bounce.
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[
                            { k: "Flat and opaque", v: "Hierarchy comes from value steps between solid fills. No translucency, no blur." },
                            { k: "The traveling cursor", v: "One ring physically moves between targets, with the only overshoot in the system." },
                            { k: "Snap, then settle", v: "Acknowledge in 90ms. Nothing anywhere is slower than 300ms." },
                        ].map(item => (
                            <div key={item.k} className="hh-tile p-4">
                                <div className="hh-label mb-1.5 text-[var(--hh-accent-deep)]">{item.k}</div>
                                <p className="hh-body text-xs text-[var(--hh-text-secondary)]">{item.v}</p>
                            </div>
                        ))}
                    </div>
                </header>

                {/* ── Surfaces ─────────────────────────────────────────── */}
                <Section
                    id="surfaces"
                    title="Surface ladder"
                    blurb="The core of the system. A grey room with white tiles in it, never white-on-white — keeping the page darker than its cards is what makes flat tiles read as objects without needing a shadow to separate them."
                >
                    <div className="hh-ground mb-5 rounded-[var(--hh-radius-xl)] border border-[var(--hh-border)] p-5">
                        <div className="hh-label mb-3 text-[var(--hh-text-tertiary)]">
                            The same six rungs, stacked so the steps are visible
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {SURFACE_TOKENS.map(token => (
                                <div
                                    key={token.name}
                                    className="rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] p-3"
                                    style={{ backgroundColor: `var(${token.name})` }}
                                >
                                    <div className="hh-numeric text-[0.65rem] font-bold text-[var(--hh-text-primary)]">
                                        {token.name.replace("--hh-surface-", "")}
                                    </div>
                                    <div className="mt-6 text-[0.65rem] text-[var(--hh-text-tertiary)]">{token.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <TokenTable rows={SURFACE_TOKENS} />
                </Section>

                {/* ── Borders / text / accent ──────────────────────────── */}
                <Section
                    id="color"
                    title="Borders, text and accent"
                    blurb="Borders do the separating work that shadows are not allowed to do. The accent inherits from the character theme picker, so all 26 themes drive the cursor, the active slab and every wash without a single extra token."
                >
                    <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="hh-tile p-5">
                            <div className="hh-label mb-3">Border weights</div>
                            <div className="space-y-2.5">
                                {BORDER_TOKENS.map(token => (
                                    <div key={token.name} className="flex items-center gap-3">
                                        <span
                                            className="h-9 w-24 shrink-0 rounded-[var(--hh-radius-md)] bg-[var(--hh-surface-2)]"
                                            style={{ border: `1px solid var(${token.name})` }}
                                        />
                                        <code className="font-mono text-xs text-[var(--hh-text-secondary)]">{token.name}</code>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="hh-tile p-5">
                            <div className="hh-label mb-3">Accent ramp</div>
                            <div className="grid grid-cols-3 gap-2">
                                {ACCENT_TOKENS.map(token => (
                                    <div key={token.name} className="overflow-hidden rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                                        <div className="h-11" style={{ backgroundColor: `var(${token.name})` }} />
                                        <div className="bg-[var(--hh-surface-1)] px-2 py-1.5 font-mono text-[0.6rem] text-[var(--hh-text-secondary)]">
                                            {token.name.replace("--hh-accent", "accent") || "accent"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mb-5 hh-tile p-5">
                        <div className="hh-label mb-3">Text ramp</div>
                        <div className="space-y-1.5">
                            <p className="hh-body text-base text-[var(--hh-text-primary)]">
                                Primary — the quick brown fox jumps over the lazy dog
                            </p>
                            <p className="hh-body text-sm text-[var(--hh-text-secondary)]">
                                Secondary — the quick brown fox jumps over the lazy dog
                            </p>
                            <p className="hh-body text-sm text-[var(--hh-text-tertiary)]">
                                Tertiary — the quick brown fox jumps over the lazy dog
                            </p>
                            <p className="hh-body inline-block rounded-[var(--hh-radius-md)] bg-[var(--hh-accent)] px-3 py-1 text-sm text-[var(--hh-text-on-accent)]">
                                On accent — the quick brown fox
                            </p>
                        </div>
                    </div>

                    <TokenTable rows={[...TEXT_TOKENS, ...ACCENT_TOKENS]} />
                </Section>

                {/* ── Radii ────────────────────────────────────────────── */}
                <Section
                    id="radii"
                    title="Radius ladder"
                    blurb="Console geometry is crisp, not pill-soft. Which rung a component picks is a statement about what kind of object it is: structure climbs, and everything the user presses sits one rung below the tile it lives on. Fully-round is reserved for things that are genuinely round."
                >
                    <div className="mb-5 flex flex-wrap items-end gap-4">
                        {RADIUS_LADDER.map(entry => (
                            <div key={entry.name} className="flex flex-col items-center gap-2">
                                <div
                                    className="h-16 w-16 border border-[var(--hh-border-strong)] bg-[var(--hh-surface-2)]"
                                    style={{ borderRadius: `var(${entry.name})` }}
                                />
                                <span className="hh-numeric text-[0.65rem] text-[var(--hh-text-tertiary)]">{entry.px}</span>
                            </div>
                        ))}
                    </div>

                    <div className="hh-tile overflow-hidden">
                        <table className="hh-table">
                            <thead className="hh-table-head">
                                <tr>
                                    <th className="hh-label px-4 py-2.5 text-left">Token</th>
                                    <th className="hh-label px-4 py-2.5 text-left">Value</th>
                                    <th className="hh-label px-4 py-2.5 text-left">Pick it for</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RADIUS_LADDER.map(entry => (
                                    <tr key={entry.name} className="hh-table-row">
                                        <td className="px-4 py-2.5">
                                            <code className="font-mono text-xs text-[var(--hh-text-primary)]">{entry.name}</code>
                                        </td>
                                        <td className="hh-numeric px-4 py-2.5 text-xs text-[var(--hh-text-secondary)]">{entry.px}</td>
                                        <td className="hh-body px-4 py-2.5 text-xs text-[var(--hh-text-tertiary)]">{entry.use}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hh-tile hh-tile-tint mt-4 p-4" style={tintStyle("var(--hh-accent)")}>
                        <p className="hh-body text-xs text-[var(--hh-text-secondary)]">
                            Write the rung explicitly — <code className={CODE_CLASS}>rounded-[var(--hh-radius-lg)]</code> —
                            rather than a numbered utility. The utility scale is retuned to match the ladder, but naming the
                            rung is what records the intent, and it survives a future retune of the scale.
                            Nested boxes step down by exactly one rung: an inner radius equals the outer radius minus the gap
                            between them, or the arcs stop being concentric and the trough visibly pinches at the corners.
                        </p>
                    </div>
                </Section>

                {/* ── Elevation ────────────────────────────────────────── */}
                <Section
                    id="elevation"
                    title="Elevation"
                    blurb="Small, tight, low-opacity. A large soft shadow immediately reads as a phone OS instead of a console, so the blur radii stay deliberately short — separation is the borders' job, not the shadows'."
                >
                    <div className="hh-ground mb-5 grid grid-cols-2 gap-6 rounded-[var(--hh-radius-xl)] border border-[var(--hh-border)] p-8 lg:grid-cols-4">
                        {SHADOW_TOKENS.map(token => (
                            <div key={token.name} className="flex flex-col items-center gap-3">
                                <div
                                    className="flex h-20 w-full items-center justify-center rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-xs text-[var(--hh-text-tertiary)]"
                                    style={{ boxShadow: `var(${token.name})` }}
                                >
                                    {token.value}
                                </div>
                                <code className="font-mono text-[0.65rem] text-[var(--hh-text-secondary)]">{token.name}</code>
                            </div>
                        ))}
                    </div>
                    <TokenTable rows={SHADOW_TOKENS} />
                </Section>

                {/* ── Motion ───────────────────────────────────────────── */}
                <Section
                    id="motion"
                    title="Motion"
                    blurb="Overshoot is a privilege, not a default. Exactly one thing in the system may spring past its target and settle back — the selection cursor. Everything structural is critically damped and simply arrives. Stiffness is usually misdiagnosed as too little animation when the real cause is too much duration."
                >
                    <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="hh-tile p-5 lg:col-span-2">
                            <div className="hh-label mb-3">Entrance animations</div>
                            <div key={replayKey} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    { cls: "hh-animate-screen-in", label: "screen-in" },
                                    { cls: "hh-animate-sheet-in", label: "sheet-in" },
                                    { cls: "hh-animate-rail-in", label: "rail-in" },
                                    { cls: "hh-animate-tile-in", label: "tile-in" },
                                ].map(item => (
                                    <div
                                        key={item.cls}
                                        className={`${item.cls} flex h-16 items-center justify-center rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] font-mono text-[0.65rem] text-[var(--hh-text-secondary)]`}
                                    >
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className={`${DEMO_BTN_CLASS} mt-3 px-4 py-1.5 text-xs`}
                                onClick={() => setReplayKey(k => k + 1)}
                            >
                                Replay
                            </button>
                        </div>

                        <div className="hh-tile p-5">
                            <div className="hh-label mb-3">Presets in lib/motion</div>
                            <ul className="hh-numeric space-y-1 font-mono text-[0.68rem] text-[var(--hh-text-secondary)]">
                                <li>hhSpringCursor · bounce 0.28</li>
                                <li>hhSpringSelect · bounce 0.22</li>
                                <li>hhSpringPress · bounce 0</li>
                                <li>hhSpringPanel · bounce 0</li>
                                <li>hhTweenScreen · bounce 0</li>
                                <li>springMomentum · bounce 0.2</li>
                            </ul>
                            <p className="hh-body mt-3 text-[0.68rem] text-[var(--hh-text-tertiary)]">
                                Only the first two and the momentum handoff carry bounce. Everything else is furniture.
                            </p>
                        </div>
                    </div>

                    <TokenTable rows={MOTION_TOKENS} />
                </Section>

                {/* ── Primitives ───────────────────────────────────────── */}
                <Section
                    id="primitives"
                    title="Primitives"
                    blurb="The base vocabulary. Everything in this layer supplies DEFAULTS — a utility written on the same element is meant to win, so never reach for !important to force one through."
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                        <Spec name=".hh-tile" purpose="The default object: a card, a home-menu square. Surface-2, 1px ring, 12px corner, resting shadow.">
                            <div className="hh-tile flex h-20 w-full items-center justify-center text-xs text-[var(--hh-text-tertiary)]">tile</div>
                        </Spec>

                        <Spec name=".hh-panel" purpose="Structural chrome — top bar, side rail, sheet. One step flatter than a tile so tiles can sit on top without shadow collisions.">
                            <div className="hh-panel flex h-20 w-full items-center justify-center text-xs text-[var(--hh-text-tertiary)]">panel</div>
                        </Spec>

                        <Spec name=".hh-float" purpose="A floating layer — dropdown, popover, dialog. The only rung allowed a large shadow.">
                            <div className="hh-float flex h-20 w-full items-center justify-center text-xs text-[var(--hh-text-tertiary)]">float</div>
                        </Spec>

                        <Spec name=".hh-well" purpose="A sunken area cut into the page: list backgrounds, input troughs, empty states.">
                            <div className="hh-well flex h-20 w-full items-center justify-center text-xs text-[var(--hh-text-tertiary)]">well</div>
                        </Spec>

                        <Spec name=".hh-scrim" purpose="Modal backdrop. Opaque-dark rather than blurred, consistent with dropping backdrop-filter everywhere else.">
                            <div className="relative h-20 w-full overflow-hidden rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] bg-[var(--hh-surface-3)]">
                                <div className="hh-scrim absolute inset-0 flex items-center justify-center text-xs text-white">scrim</div>
                            </div>
                        </Spec>

                        <Spec name=".hh-divider" purpose="An edge-to-edge hairline. Rows are separated by a line, not by gaps.">
                            <div className="w-full space-y-2.5 text-xs text-[var(--hh-text-secondary)]">
                                <div>Row one</div>
                                <hr className="hh-divider" />
                                <div>Row two</div>
                            </div>
                        </Spec>

                        <Spec name=".hh-btn / -primary / -danger" purpose="A slab, not a pill. Padding is a default: write your own px/py and it wins." wide>
                            <div className="flex flex-wrap items-center gap-3">
                                <button type="button" className={`${DEMO_BTN_CLASS} px-5 py-2`}>Default</button>
                                <button type="button" className={`${DEMO_BTN_CLASS} hh-btn-primary px-5 py-2`}>Primary</button>
                                <button type="button" className={`${DEMO_BTN_CLASS} hh-btn-danger px-5 py-2`}>Danger</button>
                                <button type="button" className={`${DEMO_BTN_CLASS} px-5 py-2`} disabled>Disabled</button>
                            </div>
                        </Spec>

                        <Spec name=".hh-input" purpose="Trough treatment plus an accent focus ring. Focus replaces the border colour rather than adding a glow.">
                            <div className="w-full space-y-2">
                                <input type="text" placeholder="Search..." className="hh-input w-full px-3 py-2 text-sm" />
                                <input type="text" defaultValue="Invalid value" className="hh-input w-full border-[var(--hh-accent-alert)] px-3 py-2 text-sm text-[var(--hh-accent-alert)]" />
                            </div>
                        </Spec>

                        <Spec name=".hh-chip / -active" purpose="Filter chips on every list page. 8px, not a capsule — the capsule belongs to the vocabulary this replaced.">
                            <div className="flex flex-wrap gap-2">
                                {["all", "cool", "cute", "pure"].map(chip => (
                                    <button
                                        key={chip}
                                        type="button"
                                        className={`hh-chip hh-press hh-focusable ${activeChip === chip ? "hh-chip-active" : ""}`}
                                        onClick={() => { setActiveChip(chip); playHandheldSound("cursor"); }}
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </Spec>

                        <Spec name=".hh-segment / -item" purpose="Segmented control. Fills its container by default; the active segment is a solid slab above a sunken trough." wide>
                            <div className="w-full space-y-3">
                                <div className="hh-segment">
                                    {(["overview", "details"] as const).map(tab => (
                                        <button
                                            key={tab}
                                            type="button"
                                            className="hh-segment-item hh-focusable"
                                            data-selected={segmentTab === tab}
                                            aria-pressed={segmentTab === tab}
                                            onClick={() => { setSegmentTab(tab); playHandheldSound("cursor"); }}
                                        >
                                            {tab === "overview" ? "Overview" : "Details"}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="hh-body shrink-0 text-xs text-[var(--hh-text-tertiary)]">In a header row:</span>
                                    <div className="hh-segment hh-segment-fit">
                                        <button type="button" className="hh-segment-item" data-selected aria-pressed>Fit</button>
                                        <button type="button" className="hh-segment-item">Content</button>
                                    </div>
                                    <span className="hh-body truncate text-xs text-[var(--hh-text-tertiary)]">neighbours keep their space</span>
                                </div>
                            </div>
                        </Spec>

                        <Spec name=".hh-switch / -thumb" purpose="Binary switch. One of the few genuinely capsule-shaped elements in the system, which is why it keeps the full radius.">
                            <button
                                type="button"
                                className={`hh-switch hh-focusable ${switchOn ? "hh-switch-active" : ""}`}
                                role="switch"
                                aria-checked={switchOn}
                                aria-label="Demo switch"
                                onClick={() => { setSwitchOn(v => !v); playHandheldSound("toggle"); }}
                            >
                                <span className="hh-switch-thumb" />
                            </button>
                        </Spec>

                        <Spec name=".hh-press" purpose="Press acknowledgment: sinks to 96.5% in 90ms on pointer-down. Also carries touch-action and tap-highlight hygiene.">
                            <button type="button" className={`${DEMO_BTN_CLASS} px-6 py-3`}>Press and hold</button>
                        </Spec>

                        <Spec name=".hh-focusable" purpose="Keyboard-only cursor ring. Pointer users never see it; keyboard and gamepad users always do. Tab to it.">
                            <button type="button" className="hh-focusable hh-tile px-5 py-2.5 text-sm text-[var(--hh-text-primary)]">Tab here</button>
                        </Spec>

                        <Spec name=".hh-selected / -outline" purpose="Where the cursor is (lifts and brightens) versus statically selected items (holds still). Use -outline in grids: a spread ring does not participate in layout, so toggling it cannot nudge neighbours.">
                            <div className="flex items-center gap-4">
                                <div className="hh-tile hh-selected flex h-14 w-14 items-center justify-center text-[0.6rem] text-[var(--hh-text-tertiary)]">cursor</div>
                                <div className="hh-tile hh-selected-outline flex h-14 w-14 items-center justify-center text-[0.6rem] text-[var(--hh-text-tertiary)]">picked</div>
                                <div className="hh-tile flex h-14 w-14 items-center justify-center text-[0.6rem] text-[var(--hh-text-tertiary)]">idle</div>
                            </div>
                        </Spec>

                        <Spec name=".hh-label" purpose="Uppercase micro-heading with positive tracking. Section captions and table headers.">
                            <span className="hh-label">Section label</span>
                        </Spec>

                        <Spec name=".hh-display / -title / -body" purpose="The type scale. Console text is tight and even-weight, and never light-weight at body size." wide>
                            <div className="w-full space-y-2">
                                <p className="hh-display text-3xl text-[var(--hh-text-primary)]">Display · tight leading</p>
                                <p className="hh-title text-xl text-[var(--hh-text-primary)]">Title · headings and card names</p>
                                <p className="hh-body text-sm text-[var(--hh-text-secondary)]">Body · 1.55 leading, weight 400, never lighter</p>
                            </div>
                        </Spec>

                        <Spec name=".hh-numeric" purpose="Tabular figures. Mandatory on any number that ticks or sits in a column — without it the digits change width and the row jitters." wide>
                            <div className="grid w-full grid-cols-2 gap-6 text-sm">
                                <div>
                                    <div className="hh-label mb-1.5 text-[var(--hh-accent-alert)]">Without</div>
                                    <div className="text-[var(--hh-text-secondary)]">1,204,880</div>
                                    <div className="text-[var(--hh-text-secondary)]">1,111,111</div>
                                    <div className="text-[var(--hh-text-secondary)]">9,000,009</div>
                                </div>
                                <div>
                                    <div className="hh-label mb-1.5 text-[var(--hh-accent-deep)]">With</div>
                                    <div className="hh-numeric text-[var(--hh-text-primary)]">1,204,880</div>
                                    <div className="hh-numeric text-[var(--hh-text-primary)]">1,111,111</div>
                                    <div className="hh-numeric text-[var(--hh-text-primary)]">9,000,009</div>
                                </div>
                            </div>
                        </Spec>

                    </div>
                </Section>

                {/* ── Sedimented utilities ─────────────────────────────── */}
                <Section
                    id="patterns"
                    title="Sedimented patterns"
                    blurb="Recipes that were being hand-assembled from the same four to six utilities over and over. Each was measured at the call sites before being named, and each is named for what it IS rather than what it looks like, so a later retune of the ramp moves them together."
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                        <Spec name=".hh-section-header" purpose="The header strip inside a tile. 31 hand-written copies. Draws only the bottom border — the tile already owns the other three edges.">
                            <div className="hh-tile hh-list w-full">
                                <div className="hh-section-header hh-title text-sm text-[var(--hh-text-primary)]">Header strip</div>
                                <div className="hh-body p-4 text-xs text-[var(--hh-text-secondary)]">Body sits on the brighter rung.</div>
                            </div>
                        </Spec>

                        <Spec name=".hh-list" purpose="Rows, not cards. Composes with a tile — write hh-tile hh-list. The separator sits between rows only, so nothing lands on the container border.">
                            <div className="hh-tile hh-list w-full text-xs text-[var(--hh-text-secondary)]">
                                {["First row", "Second row", "Third row"].map(row => (
                                    <div key={row} className="px-4 py-2.5">{row}</div>
                                ))}
                            </div>
                        </Spec>

                        <Spec name=".hh-table / -head / -row" purpose="Table vocabulary. Deliberately does not set display, so it works on real tables and on div grids alike. Rows are transparent, so zebra striping stays opt-in.">
                            <table className="hh-table text-xs">
                                <thead className="hh-table-head">
                                    <tr><th className="hh-label px-3 py-2 text-left">Rank</th><th className="hh-label px-3 py-2 text-left">Score</th></tr>
                                </thead>
                                <tbody>
                                    {[[1, "1,204,880"], [2, "1,180,004"]].map(([rank, score]) => (
                                        <tr key={rank} className="hh-table-row">
                                            <td className="hh-numeric px-3 py-2 text-[var(--hh-text-secondary)]">{rank}</td>
                                            <td className="hh-numeric px-3 py-2 text-[var(--hh-text-primary)]">{score}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Spec>

                        <Spec name=".hh-scrim-media + .hh-badge-on-media" purpose="Text on a photograph. Both hardcode black on purpose: they darken artwork that looks identical in both themes, so a theme-following scrim would invert in dark mode and stop protecting the white text.">
                            <div className="relative h-24 w-full overflow-hidden rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                                <img src="/miku.webp" alt="Media scrim demo" className="h-full w-full object-cover" />
                                <div className="hh-scrim-media absolute inset-0" />
                                <span className="hh-badge-on-media hh-numeric absolute left-2 top-2 px-1.5 py-0.5 text-[0.6rem]">02:41</span>
                                <span className="absolute bottom-2 left-2 text-xs font-bold text-white">Legible over anything</span>
                            </div>
                        </Spec>

                        <Spec name=".hh-spinner / -on-accent" purpose="Ring loader, ~50 hand-rolled copies in three inconsistent spellings. Inherits its size from the box and its colour from the accent, so it works inline in a button and centred in a panel.">
                            <div className="flex items-center gap-5">
                                <span className="hh-spinner h-5 w-5" />
                                <span className="hh-spinner h-8 w-8" />
                                <span className="hh-btn hh-btn-primary px-4 py-2 text-sm">
                                    <span className="hh-spinner hh-spinner-on-accent h-4 w-4" />
                                    Loading
                                </span>
                            </div>
                        </Spec>

                        <Spec name=".hh-meter / -fill" purpose="Progress and range. The track uses the inset rung because a meter reads as a channel cut into the surface. Width of the fill is the caller's job — it is the data.">
                            <div className="w-full space-y-2">
                                {[72, 38].map(pct => (
                                    <div key={pct} className="flex items-center gap-3">
                                        <div className="hh-meter">
                                            <div className="hh-meter-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="hh-numeric w-9 shrink-0 text-right text-[0.65rem] text-[var(--hh-text-tertiary)]">{pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </Spec>

                        <Spec name=".hh-kbd" purpose="Keycap. 8 copies across the shortcut help, command palette, settings and navbar. min-width plus centring is what keeps a row of single-character caps optically even.">
                            <div className="flex items-center gap-2 text-xs text-[var(--hh-text-tertiary)]">
                                <kbd className="hh-kbd">Ctrl</kbd>
                                <span>+</span>
                                <kbd className="hh-kbd">K</kbd>
                                <span className="mx-1.5">/</span>
                                <kbd className="hh-kbd">↑</kbd>
                                <kbd className="hh-kbd">↓</kbd>
                                <kbd className="hh-kbd">⏎</kbd>
                            </div>
                        </Spec>

                        <Spec name=".hh-checker" purpose="Transparency backdrop in the asset viewer. Functional, not decorative: without it a transparent PNG and a white PNG are indistinguishable. --hh-checker-size tunes the pitch.">
                            <div className="hh-checker flex h-20 w-full items-center justify-center rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                                <span className="rounded-[var(--hh-radius-sm)] bg-[var(--hh-accent)] px-3 py-1.5 text-[0.65rem] text-[var(--hh-text-on-accent)]">
                                    alpha asset
                                </span>
                            </div>
                        </Spec>

                        <Spec name=".hh-tile-tint" purpose="Semantic notice card. Takes one --hh-tint and derives fill, border and text from it, so the four advisory variants stop being four unrelated colour triplets. Mixes against the surface, so it survives the theme flip.">
                            <div className="w-full space-y-2">
                                {[
                                    { tint: "var(--hh-accent-alert)", label: "Destructive / spoiler" },
                                    { tint: "var(--hh-accent)", label: "Informational" },
                                ].map(item => (
                                    <div key={item.label} className="hh-tile hh-tile-tint px-3 py-2 text-xs text-[var(--hh-text-secondary)]" style={tintStyle(item.tint)}>
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                        </Spec>

                        <Spec name=".hh-segment-fit" purpose="Shrink-to-fit escape from the segmented control's full-width default. All three of width:auto, flex-grow:0 and flex-shrink:0 are required; the last is what stops labels collapsing into ellipsis on a tight row.">
                            <div className="hh-segment hh-segment-fit">
                                <button type="button" className="hh-segment-item" data-selected aria-pressed>Fit</button>
                                <button type="button" className="hh-segment-item">Wide</button>
                            </div>
                        </Spec>

                        <Spec name=".hh-selected-outline" purpose="Selected, but stays put. For grids where several items are selected at once and none of them is where the cursor is — scaling them all up just makes the grid jitter.">
                            <div className="flex gap-3">
                                <div className="hh-tile hh-selected-outline h-14 w-14" />
                                <div className="hh-tile hh-selected-outline h-14 w-14" />
                                <div className="hh-tile h-14 w-14" />
                            </div>
                        </Spec>

                        <Spec name=".hh-numeric-slashed" purpose="Opt-in slashed zero. Only for alphanumeric identifiers where 0-vs-O is genuinely ambiguous — never for plain digit runs, which have no O to confuse.">
                            <div className="space-y-1 font-mono text-xs">
                                <div className="hh-numeric-slashed text-[var(--hh-text-primary)]">res021_no018</div>
                                <div className="hh-numeric-slashed text-[var(--hh-text-primary)]">v0.10.0-B0OT</div>
                            </div>
                        </Spec>

                        <Spec name=".hh-allow-blur" purpose="The escape hatch from global blur neutralization. For overlays that obscure content functionally — spoiler shields, loading veils — where flattening would leak the thing they exist to cover. Not a way to reintroduce glass." wide>
                            <div className="hh-allow-blur relative h-24 w-full overflow-hidden rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)]">
                                <div className="absolute inset-0 flex items-center justify-center bg-[var(--hh-surface-3)] text-sm font-bold text-[var(--hh-text-primary)]">
                                    Spoiler content behind the shield
                                </div>
                                {/*
                                  The shield is written as an inline filter rather than as the utility this
                                  page documents. Both routes reach the same rendered result, but the utility
                                  form would leave a live blur class in the migrated codebase for a grep to
                                  trip over; the mechanism itself is described in the pitfalls section.
                                */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center bg-[rgba(24,26,30,0.28)]"
                                    style={{ backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)" }}
                                >
                                    <span className="hh-badge-on-media px-2.5 py-1 text-xs font-bold">Tap to reveal</span>
                                </div>
                            </div>
                        </Spec>

                    </div>
                </Section>

                {/* ── Geometric marks & Design Soul ───────────────────── */}
                <Section
                    id="geometric-marks"
                    title="Geometric vocabulary & Semantic marks"
                    blurb="A native 4-symbol geometric vocabulary derived from rhythm game precision, character accents, and handheld console state registers. Zero third-party proprietary glyphs."
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="hh-tile p-5">
                            <div className="flex h-16 items-center justify-center gap-3">
                                <HandheldMark type="pip" size="lg" tone="accent" />
                                <HandheldMark type="pip" size="lg" />
                                <span className="hh-mark-pip" />
                            </div>
                            <div className="mt-3 border-t border-[var(--hh-border)] pt-3">
                                <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">pip / diamond</code>
                                <p className="hh-body mt-1 text-xs text-[var(--hh-text-secondary)]">45° diamond pip. Status indicator, active note beat, selection dot.</p>
                            </div>
                        </div>

                        <div className="hh-tile p-5">
                            <div className="flex h-16 items-center justify-center gap-3">
                                <HandheldMark type="tick" size="lg" tone="accent" />
                                <span className="hh-mark-tick" />
                            </div>
                            <div className="mt-3 border-t border-[var(--hh-border)] pt-3">
                                <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">tick / segment</code>
                                <p className="hh-body mt-1 text-xs text-[var(--hh-text-secondary)]">Hairline tick segment. Precision tab indicator, hairline divider pip.</p>
                            </div>
                        </div>

                        <div className="hh-tile p-5">
                            <div className="flex h-16 items-center justify-center gap-3">
                                <HandheldMark type="bracket" size="lg" tone="accent" />
                                <span className="hh-mark-bracket" />
                            </div>
                            <div className="mt-3 border-t border-[var(--hh-border)] pt-3">
                                <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">bracket / viewfinder</code>
                                <p className="hh-body mt-1 text-xs text-[var(--hh-text-secondary)]">Viewfinder corner bracket. Card focus, HUD targeting frame.</p>
                            </div>
                        </div>

                        <div className="hh-tile p-5">
                            <div className="flex h-16 items-center justify-center gap-3">
                                <HandheldMark type="chevron" size="lg" tone="accent" />
                                <span className="hh-mark-chevron" />
                            </div>
                            <div className="mt-3 border-t border-[var(--hh-border)] pt-3">
                                <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">chevron / prism</code>
                                <p className="hh-body mt-1 text-xs text-[var(--hh-text-secondary)]">Cadence chevron. Kinetic direction, disclosure trigger, rhythm progress.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 hh-tile p-6">
                        <h4 className="hh-title text-sm mb-4">Scalable Empty State Specimen</h4>
                        <div className="rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] bg-[var(--hh-surface-1)] p-6">
                            <HandheldEmptyState
                                title="No matching entries found"
                                description="Try adjusting your filters or clearing search queries."
                            />
                        </div>
                    </div>
                </Section>

                {/* ── Traveling focus & Pointer interactions ──────────── */}
                <Section
                    id="traveling-focus"
                    title="Traveling focus & Pointer interactions"
                    blurb="Pointer hover, touch tap, and D-pad/keyboard navigation unify into a single traveling cursor system using shared-layout spring physics."
                >
                    <DesignSystemTravelingFocusDemo />
                </Section>

                {/* ── Console cursors & Scrollbars ────────────────────── */}
                <Section
                    id="cursor-and-scrollbars"
                    title="Console cursors & Handheld scrollbars"
                    blurb="Hardware-inspired vector cursors and clean geometric scrollbars matching the console surface ladder."
                >
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Cursor test pads */}
                        <div className="hh-tile p-5">
                            <h4 className="hh-title text-sm mb-3">Custom Vector Cursors (Pointer Coarse Ignored)</h4>
                            <p className="hh-body text-xs text-[var(--hh-text-secondary)] mb-4">
                                Hover over each surface below to test crisp SVG reticle and pointer states.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="hh-well flex h-16 flex-col items-center justify-center cursor-default rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]">
                                    <span className="font-mono text-xs font-bold">Default Arrow</span>
                                    <span className="text-[10px] text-[var(--hh-text-tertiary)]">cursor-default</span>
                                </div>
                                <div className="hh-well flex h-16 flex-col items-center justify-center cursor-pointer rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] hover:bg-[var(--hh-surface-3)]">
                                    <span className="font-mono text-xs font-bold text-[var(--hh-accent-deep)]">Interactive Pointer</span>
                                    <span className="text-[10px] text-[var(--hh-text-tertiary)]">cursor-pointer</span>
                                </div>
                                <div className="hh-well flex h-16 flex-col items-center justify-center cursor-grab rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] active:cursor-grabbing">
                                    <span className="font-mono text-xs font-bold">Draggable Reticle</span>
                                    <span className="text-[10px] text-[var(--hh-text-tertiary)]">cursor-grab</span>
                                </div>
                                <div className="hh-well flex h-16 flex-col items-center justify-center cursor-not-allowed rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] opacity-60">
                                    <span className="font-mono text-xs font-bold">Disabled Slashed</span>
                                    <span className="text-[10px] text-[var(--hh-text-tertiary)]">cursor-not-allowed</span>
                                </div>
                            </div>
                        </div>

                        {/* Scrollbar test box */}
                        <div className="hh-tile p-5">
                            <h4 className="hh-title text-sm mb-3">Handheld Geometric Scrollbar</h4>
                            <p className="hh-body text-xs text-[var(--hh-text-secondary)] mb-4">
                                Scroll the list below to inspect the 6px flat thumb and accent hover response.
                            </p>
                            <div className="hh-well max-h-48 overflow-y-auto rounded-[var(--hh-radius-md)] border border-[var(--hh-border)] p-3">
                                <div className="space-y-2">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="flex items-center justify-between rounded bg-[var(--hh-surface-1)] px-3 py-2 text-xs">
                                            <span className="font-mono text-[var(--hh-text-secondary)]">TRACK_ITEM_{String(i + 1).padStart(2, "0")}</span>
                                            <HandheldMark type="pip" size="sm" tone={i % 3 === 0 ? "accent" : "muted"} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ── Pitfalls ─────────────────────────────────────────── */}
                <Section
                    id="pitfalls"
                    title="Architecture pitfalls"
                    blurb="The most valuable part of this page. Every entry below cost at least one batch of the migration to find, and most of them fail silently — they compile, they pass lint, they pass the type checker, and then do nothing at runtime."
                >
                    <div className="space-y-4">
                        {PITFALLS.map((pitfall, index) => (
                            <div
                                key={pitfall.title}
                                className="hh-tile hh-tile-tint p-5"
                                style={tintStyle(pitfall.critical ? "var(--hh-accent-alert)" : "var(--hh-accent)")}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="hh-numeric mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--hh-radius-sm)] bg-[var(--hh-surface-1)] text-xs font-bold text-[var(--hh-text-secondary)]">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="hh-title flex flex-wrap items-center gap-2 text-base text-[var(--hh-text-primary)]">
                                            {pitfall.title}
                                            {pitfall.critical && (
                                                <span className="hh-label rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent-alert)] px-1.5 py-0.5 text-white">
                                                    silent failure
                                                </span>
                                            )}
                                        </h3>
                                        <p className="hh-body mt-2 text-sm text-[var(--hh-text-secondary)]">
                                            <span className="hh-label mr-2 text-[var(--hh-text-tertiary)]">Symptom</span>
                                            {pitfall.symptom}
                                        </p>
                                        <p className="hh-body mt-2 text-sm text-[var(--hh-text-secondary)]">
                                            <span className="hh-label mr-2 text-[var(--hh-accent-deep)]">Rule</span>
                                            {pitfall.rule}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* ── Sound ────────────────────────────────────────────── */}
                <Section
                    id="sound"
                    title="Sound"
                    blurb="Six UI ticks, synthesized from oscillators at play time — no audio file is ever downloaded, so nothing lands in the bundle or on the network waterfall. All six are short and dry on purpose: a UI tick that rings is worse than silence."
                >
                    {!handheldSoundEnabled && (
                        <div className="hh-tile hh-tile-tint mb-4 p-4" style={tintStyle("var(--hh-accent-alert)")}>
                            <p className="hh-body text-sm text-[var(--hh-text-secondary)]">
                                <span className="font-bold text-[var(--hh-text-primary)]">Sound is currently off.</span>{" "}
                                It is off by default and stays off until the user asks for it — a site that starts making
                                noise on its own is hostile, especially with headphones on or in a background tab. Turn it on
                                under Settings to audition the buttons below. Note that the engine deliberately does NOT
                                consult the reduced-motion preference: sound is not motion, and treating it as motion silently
                                muted the whole engine for anyone with that setting while the switch still read as on.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {SOUND_CATALOG.map(sound => (
                            <div key={sound.name} className="hh-tile hh-list">
                                <div className="p-4">
                                    <button
                                        type="button"
                                        className={`${DEMO_BTN_CLASS} w-full px-4 py-2.5`}
                                        onClick={() => playHandheldSound(sound.name)}
                                    >
                                        Play {sound.name}
                                    </button>
                                </div>
                                <div className="bg-[var(--hh-surface-1)] px-4 py-3">
                                    <code className="block font-mono text-xs font-bold text-[var(--hh-accent-deep)]">
                                        playHandheldSound(&quot;{sound.name}&quot;)
                                    </code>
                                    <p className="hh-body mt-1 text-xs font-semibold text-[var(--hh-text-primary)]">{sound.meaning}</p>
                                    <p className="hh-body mt-0.5 text-xs text-[var(--hh-text-secondary)]">{sound.when}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hh-tile mt-4 p-5">
                        <div className="hh-label mb-2">Integration notes</div>
                        <ul className="hh-body list-inside list-disc space-y-1.5 text-xs text-[var(--hh-text-secondary)]">
                            <li>Import from <code className={CODE_CLASS}>@/lib/handheld-sound</code>. The module is SSR-safe: nothing touches the audio API at module scope.</li>
                            <li>Repeats of the same sound inside a 30ms window are dropped, so key-repeat and fast cursor sweeps cannot stack into a buzz.</li>
                            <li>Audio is unlocked on the first real user gesture regardless of the preference, so the first sound after switching it on is the toggle blip rather than silence.</li>
                            <li>Every call is wrapped: a broken blip is never allowed to break a page.</li>
                        </ul>
                    </div>
                </Section>

                {/* ── Composite components ─────────────────────────────── */}
                <Section
                    id="components"
                    title="Composite components"
                    blurb="Shared components assembled from the primitives above. Prefer these over rebuilding the pattern locally — every one of them was factored out after the same layout appeared in five or more places."
                >
                    <div className="mb-4 hh-tile hh-list">
                        <div className="hh-section-header hh-title text-sm text-[var(--hh-text-primary)]">Modal / dialog</div>
                        <div className="p-5">
                            <p className="hh-body mb-4 text-sm text-[var(--hh-text-secondary)]">
                                Rendered through <code className={CODE_CLASS}>createPortal</code> so it is centred in the
                                viewport regardless of rail state, with a flat <code className={CODE_CLASS}>.hh-scrim</code>{" "}
                                backdrop, escape-to-close, background scroll lock and four width presets.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                {(["sm", "md", "lg", "xl"] as const).map(size => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => openModal(size)}
                                        className={`${DEMO_BTN_CLASS} ${size === "md" ? "hh-btn-primary" : ""} px-5 py-2`}
                                    >
                                        {size}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setIsImageModalOpen(true)}
                                    className={`${DEMO_BTN_CLASS} px-5 py-2`}
                                >
                                    Image preview
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4 hh-tile hh-list">
                        <div className="hh-section-header hh-title text-sm text-[var(--hh-text-primary)]">Quick filter</div>
                        <div className="p-5">
                            <p className="hh-body mb-4 text-sm text-[var(--hh-text-secondary)]">
                                A page registers its filter panel through <code className={CODE_CLASS}>useQuickFilter(title, content, deps)</code>{" "}
                                and a floating funnel button appears at the bottom right, above the back-to-top control. The button
                                only renders when something is registered, and registration is dropped on unmount. This page has one
                                registered right now — open it from the corner.
                            </p>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <div className="hh-label mb-2">Inline preview</div>
                                    <div className="max-w-sm">{quickFilterContent}</div>
                                </div>
                                <div>
                                    <div className="hh-label mb-2">Live state</div>
                                    <div className="hh-well p-4 font-mono text-xs text-[var(--hh-text-secondary)]">
                                        <div>search: &quot;{demoSearch || "(empty)"}&quot;</div>
                                        <div>sortBy: &quot;{demoSortBy}&quot; / order: &quot;{demoSortOrder}&quot;</div>
                                        <div>category: &quot;{demoCategory}&quot;</div>
                                        <div>toggle: {demoToggle ? "true" : "false"}</div>
                                        <div className="hh-numeric">filtered: {demoFilteredCount} / {demoTotalCount}</div>
                                    </div>
                                    {hasActiveFilters && (
                                        <span className="hh-chip hh-chip-active mt-3">Filters active</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hh-tile hh-list">
                        <div className="hh-section-header hh-title text-sm text-[var(--hh-text-primary)]">Card thumbnail</div>
                        <div className="p-5">
                            <p className="hh-body mb-5 text-sm text-[var(--hh-text-secondary)]">
                                SVG-based component reproducing the official in-game thumbnail layering — frame, attribute,
                                rarity and mastery stars — so it stays crisp at any width.
                            </p>
                            <div className="flex flex-wrap gap-6">
                                {[
                                    { card: demoCard({ id: 1, characterId: 21, cardRarityType: "rarity_4", attr: "cool", prefix: "Always Singing", assetbundleName: "res021_no018" }), label: "4★ normal", trained: false, mastery: 0 },
                                    { card: demoCard({ id: 2, characterId: 21, cardRarityType: "rarity_4", attr: "cute", prefix: "Trained", assetbundleName: "res021_no018" }), label: "4★ trained + M5", trained: true, mastery: 5 },
                                    { card: demoCard({ id: 3, characterId: 21, cardRarityType: "rarity_birthday", attr: "happy", prefix: "Birthday", assetbundleName: "birthday_miku_2023" }), label: "birthday", trained: false, mastery: 0 },
                                    { card: demoCard({ id: 4, characterId: 26, cardRarityType: "rarity_2", attr: "mysterious", prefix: "KAITO", assetbundleName: "res026_no002" }), label: "2★ normal", trained: false, mastery: 0 },
                                ].map(item => (
                                    <div key={item.card.id} className="flex flex-col items-center gap-2">
                                        <SekaiCardThumbnail card={item.card} trained={item.trained} mastery={item.mastery} width={128} />
                                        <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)]">{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            <hr className="hh-divider my-5" />

                            <div className="hh-label mb-3">Scales without raster artefacts</div>
                            <div className="flex items-end gap-4">
                                {THUMBNAIL_SIZES.map(size => (
                                    <div key={size} className="flex flex-col items-center gap-1.5">
                                        <SekaiCardThumbnail
                                            card={demoCard({ id: 5, characterId: 1, cardRarityType: "rarity_3", attr: "pure", prefix: "Scaled", assetbundleName: "res001_no007" })}
                                            width={size}
                                        />
                                        <span className="hh-numeric text-[0.65rem] text-[var(--hh-text-tertiary)]">{size}px</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ── Scene previewer ──────────────────────────────────── */}
                <Section
                    id="scene-preview"
                    title="MySekai scene previewer"
                    blurb="Development harness for the 3D scene component. Loads a local fixture to verify OBJ and texture resolution without hitting the live asset host."
                >
                    <div className="hh-tile hh-list">
                        <div className="hh-section-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="hh-title text-sm text-[var(--hh-text-primary)]">MysekaiScenePreview</h3>
                                <p className="hh-body mt-0.5 text-xs text-[var(--hh-text-secondary)]">
                                    Fixture: <code className={CODE_CLASS}>/data/mysekai-preview/testmysekai.json</code>
                                </p>
                            </div>
                            <span className="hh-body text-xs text-[var(--hh-text-tertiary)]">
                                Original / ルナ茶 · Deployment / StarMoe · credit the original author when redistributing
                            </span>
                        </div>
                        <div className="p-4 sm:p-5">
                            <MysekaiScenePreview heightClassName="h-[560px] min-h-[480px]" compact />
                        </div>
                    </div>
                </Section>

                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Dialog example" size={modalSize}>
                    <div className="space-y-4">
                        <p className="hh-body text-sm text-[var(--hh-text-secondary)]">
                            A shared dialog rendered into a portal, so it is always centred in the viewport regardless of
                            the navigation rail and top bar.
                        </p>
                        <div className="hh-well p-4">
                            <div className="hh-label mb-2">Behaviour</div>
                            <ul className="hh-body list-inside list-disc space-y-1.5 text-sm text-[var(--hh-text-secondary)]">
                                <li>Portal-rendered, so stacking context never has to be reasoned about</li>
                                <li>Damped enter and exit transitions — a sheet is furniture and does not bounce</li>
                                <li>Escape to close, click the flat scrim to close</li>
                                <li>Background scroll is locked while open</li>
                                <li>Four width presets, and the accent follows the character theme</li>
                            </ul>
                        </div>
                        <span className="hh-chip hh-chip-active hh-numeric">size: {modalSize}</span>
                    </div>
                </Modal>

                <ImagePreviewModal
                    isOpen={isImageModalOpen}
                    onClose={() => setIsImageModalOpen(false)}
                    title="Image preview example"
                    imageUrl="/miku.webp"
                    alt="Image preview demo"
                    fileName="design_system_image_preview.webp"
                />
            </div>
        </MainLayout>
    );
}
