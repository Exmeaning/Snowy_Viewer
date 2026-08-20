"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import NextImage from "next/image";
import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { UNIT_DATA, UNIT_ICON_FILES, UNIT_ID_LABEL_KEYS } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterName } from "@/lib/i18n";

const STICKER_MAKER_BASE_URL = "https://moe.exmeaning.com/sticker-maker";

// Types
interface CharacterData {
    id: string;
    name: string;
    character: string;
    img: string;
    color: string;
    defaultText: {
        text: string;
        x: number;
        y: number;
        r: number;
        s: number;
    };
}

// Character ID mapping (string to number)
const CHAR_ID_MAP: Record<string, number> = {
    "ichika": 1, "saki": 2, "honami": 3, "shiho": 4,
    "minori": 5, "haruka": 6, "airi": 7, "shizuku": 8,
    "kohane": 9, "an": 10, "akito": 11, "toya": 12,
    "tsukasa": 13, "emu": 14, "nene": 15, "rui": 16,
    "kanade": 17, "mafuyu": 18, "ena": 19, "mizuki": 20,
    "miku": 21, "rin": 22, "len": 23, "luka": 24, "meiko": 25, "kaito": 26
};

// Available Fonts
const DEFAULT_FONTS: FontOption[] = [
    { name: "MaokenAssortedSans", labelKey: "page.stickerMaker.defaultFontLabel", file: "MaokenAssortedSans-Lite.ttf" },
];

interface FontOption {
    name: string;
    label?: string;
    labelKey?: string;
    file?: string;
    isCustom?: boolean;
}

// ==================== RangeSlider Component ====================
function RangeSlider({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
}) {
    return (
        <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-[var(--hh-text-secondary)] whitespace-nowrap min-w-[4rem]">
                {label}
            </label>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                onPointerDown={() => {
                    // Fix for mobile: Blur active element (like textarea) when touching slider
                    // to prevent keyboard from popping up or staying open
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }
                }}
                className="flex-1 h-1.5 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-full)] appearance-none cursor-pointer accent-miku
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--hh-accent)]
                    [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--hh-border-strong)]"
            />
            <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)] min-w-[2rem] text-right">
                {typeof value === "number" ? (Number.isInteger(step) ? value : value.toFixed(1)) : value}
            </span>
        </div>
    );
}

// ==================== Main StickerMakerContent ====================
export default function StickerMakerContent() {
    const { t, formatNumber } = useI18n();

    // Data
    const [allStickers, setAllStickers] = useState<CharacterData[]>([]);

    // Filters
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

    // Editor State
    const [selectedSticker, setSelectedSticker] = useState<CharacterData | null>(null);
    const [bgColor, setBgColor] = useState<"transparent" | "white">("transparent");
    const [text, setText] = useState("");
    const [position, setPosition] = useState({ x: 148, y: 58 });
    const [fontSize, setFontSize] = useState(47);
    const [textColor, setTextColor] = useState("");
    const [spaceSize, setSpaceSize] = useState(1);
    const [charSpacing, setCharSpacing] = useState(0);
    const [rotate, setRotate] = useState(-2);
    const [curve, setCurve] = useState(false);
    const [fontFamily, setFontFamily] = useState("MaokenAssortedSans");
    const [customFonts, setCustomFonts] = useState<FontOption[]>([]);

    // Canvas State
    const [loaded, setLoaded] = useState(false);
    const [fontsReady, setFontsReady] = useState(false);
    const [copied, setCopied] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stickerFileInputRef = useRef<HTMLInputElement>(null);

    // Load characters.json
    useEffect(() => {
        fetch(`${STICKER_MAKER_BASE_URL}/characters.json?v=${new Date().getTime()}`)
            .then((r) => r.json())
            .then((data: CharacterData[]) => {
                setAllStickers(data);
            });
    }, []);

    // Load fonts
    useEffect(() => {
        const loadFonts = async () => {
            const fontPromises = DEFAULT_FONTS.filter(f => f.file).map(async (font) => {
                const f = new FontFace(font.name, `url(${STICKER_MAKER_BASE_URL}/fonts/${font.file})`);
                try {
                    await f.load();
                    document.fonts.add(f);
                } catch (e) {
                    console.error(`Failed to load font ${font.name}`, e);
                }
            });
            await Promise.all(fontPromises);
            setFontsReady(true);
        };
        loadFonts();
    }, []);

    const allFonts = useMemo(() => [...DEFAULT_FONTS, ...customFonts], [customFonts]);

    // Handle Custom Font Upload
    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const fontName = `CustomFont_${Date.now()}`;
            const fontFace = new FontFace(fontName, buffer);

            await fontFace.load();
            document.fonts.add(fontFace);

            const newFontOption: FontOption = {
                name: fontName,
                label: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                isCustom: true
            };

            setCustomFonts(prev => [...prev, newFontOption]);
            setFontFamily(fontName);

            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            console.error("Error loading custom font:", error);
            alert(t("page.stickerMaker.errors.fontLoadFailed"));
        }
    };



    // Handle Custom Sticker Image Upload
    const handleStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;

            // Create a temporary sticker object
            const customSticker: CharacterData = {
                id: `custom_${Date.now()}`,
                name: t("page.stickerMaker.customImageName"),
                character: "custom", // Or use current selected char
                img: dataUrl,
                color: selectedSticker?.color || "#33CEC3", // Default color or current
                defaultText: {
                    text: t("page.stickerMaker.defaultText"),
                    x: 148,
                    y: 58,
                    r: -2,
                    s: 47
                }
            };

            handleStickerClick(customSticker);
        };
        reader.readAsDataURL(file);

        // Reset input
        if (stickerFileInputRef.current) stickerFileInputRef.current.value = "";
    };

    // Filter Logic
    const handleUnitClick = (unitId: string) => {
        if (selectedUnitIds.includes(unitId)) {
            setSelectedUnitIds(selectedUnitIds.filter((id) => id !== unitId));
        } else {
            setSelectedUnitIds([...selectedUnitIds, unitId]);
        }
        // Reset character if it doesn't belong to new unit selection
        if (selectedCharacterId) {
            // Logic to check if character belongs to remaining units can be complex,
            // for simplicity we might keep it unless strictly required to clear.
            // But let's check if we should clear it.
            // If we deselect a unit that contains the current char, we might want to clear.
            // However, sticking to "if filter allows" is better.
            // Here we just update unit selection.
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const currentUnits = selectedUnitIds.length > 0
        ? UNIT_DATA.filter(u => selectedUnitIds.includes(u.id))
        : [];

    const availableCharacterIds = useMemo(() => {
        if (currentUnits.length > 0) {
            // Flatten charIds from selected units
            return Array.from(new Set(currentUnits.flatMap(u => u.charIds)));
        } else if (selectedUnitIds.length > 0) {
            return [];
        } else {
            // Show all characters if no unit selected? 
            // Or maybe show grouped?
            // Let's show all characters available in stickermaker
            // We can derive this from allStickers, but it's better to use static data
            return Object.values(CHAR_ID_MAP);
        }
    }, [currentUnits, selectedUnitIds]);

    // Derived filtered stickers
    const filteredStickers = useMemo(() => {
        if (!selectedCharacterId) return [];
        return allStickers.filter(s => {
            const charId = CHAR_ID_MAP[s.character];
            return charId === selectedCharacterId;
        });
    }, [allStickers, selectedCharacterId]);

    // Handle Character Selection
    const handleCharacterClick = (charId: number) => {
        if (selectedCharacterId === charId) {
            setSelectedCharacterId(null);
            setSelectedSticker(null); // Clear sticker selection
        } else {
            setSelectedCharacterId(charId);
            setSelectedSticker(null); // Clear sticker selection when changing character
        }
    };

    // Handle Sticker Selection
    const handleStickerClick = (sticker: CharacterData) => {
        setSelectedSticker(sticker);
        // Reset or keep previous settings? Let's reset relevant ones but maybe keep color if desired?
        // Actually, let's keep it simple and reset.
        // setBgColor("transparent"); // Optional: reset background on new sticker? Let's keep user preference.

        // Set defaults from sticker
        // Override "text" default if it is the generic "text"
        setText(sticker.defaultText.text === "text" ? t("page.stickerMaker.defaultText") : sticker.defaultText.text);
        setPosition({ x: sticker.defaultText.x, y: sticker.defaultText.y });
        setRotate(sticker.defaultText.r);
        setFontSize(sticker.defaultText.s);
        setSpaceSize(1);
        setTextColor("");
        setCurve(false);
        // setFontFamily("YurukaStd"); // Keep previous font selection or reset? Let's keep.

        // Scroll to editor
        setTimeout(() => {
            editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);

        // Load image
        setLoaded(false);
        const img = new Image(); // Browser Image
        img.crossOrigin = "anonymous";

        // Check if img is a data URL (custom upload) or path
        const isDataUrl = sticker.img.startsWith("data:") || sticker.img.startsWith("blob:");
        img.src = isDataUrl ? sticker.img : `${STICKER_MAKER_BASE_URL}/img/${sticker.img}`;

        img.onload = () => {
            imgRef.current = img;
            setLoaded(true);
        };
    };

    // Draw on canvas
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || !loaded || !fontsReady || !selectedSticker) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 296;
        canvas.height = 256;

        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShiftX = (canvas.width - img.width * ratio) / 2;
        const centerShiftY = (canvas.height - img.height * ratio) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Background
        if (bgColor === "white") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(
            img, 0, 0, img.width, img.height,
            centerShiftX, centerShiftY, img.width * ratio, img.height * ratio
        );

        // Draw Text
        ctx.lineWidth = 9;
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(rotate / 10);
        ctx.textAlign = "center";
        ctx.strokeStyle = "white";
        ctx.fillStyle = textColor || selectedSticker.color;

        const lines = text.split("\n");
        const angle = (Math.PI * text.length) / 7;


        // Helper: get font for char
        const getFont = (char: string) => {
            if (fontFamily !== "Auto") return fontFamily;
            return /[\u4e00-\u9fa5]/.test(char) ? "SSFangTangTi" : "YurukaStd";
        };

        if (curve) {
            for (const line of lines) {
                // Adjust angle step based on charSpacing
                // Radius is roughly 3.5 * fontSize
                // Additional angle = charSpacing / Radius
                const radius = fontSize * 3.5;
                const spacingAngle = charSpacing / radius;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    ctx.font = `${fontSize}px ${getFont(char)}`;

                    // Original rotation logic + spacing adjustment
                    const baseRotation = angle / line.length / 2.5;
                    ctx.rotate(baseRotation + spacingAngle);

                    ctx.save();
                    ctx.translate(0, -1 * fontSize * 3.5);
                    ctx.strokeText(char, 0, 0);
                    ctx.fillText(char, 0, 0);
                    ctx.restore();
                }
            }
        } else {
            let k = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Calculate total width first to center
                let totalWidth = 0;
                const charWidths: number[] = [];

                // Prepare context for measurement
                // Note: We need to set font per char if Auto is selected, 
                // but for width calculation we iterate through chars anyway.

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    ctx.font = `${fontSize}px ${getFont(char)}`;
                    const w = ctx.measureText(char).width;
                    charWidths.push(w);
                    totalWidth += w;
                }

                // Add spacing to total width (n-1 spaces)
                if (line.length > 1) {
                    totalWidth += (line.length - 1) * charSpacing;
                }

                let currentX = -totalWidth / 2;

                ctx.textAlign = "left"; // Draw from left to control spacing manually

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    ctx.font = `${fontSize}px ${getFont(char)}`;

                    ctx.strokeText(char, currentX, k);
                    ctx.fillText(char, currentX, k);

                    currentX += charWidths[j] + charSpacing;
                }

                k += spaceSize;
            }
        }
        ctx.restore();
    }, [loaded, fontsReady, selectedSticker, text, position, fontSize, spaceSize, charSpacing, rotate, curve, fontFamily, bgColor, textColor]);

    useEffect(() => {
        draw();
    }, [draw]);

    // Download
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !selectedSticker) return;
        const link = document.createElement("a");
        link.download = `${selectedSticker.name}_sticker.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    // Copy
    const handleCopy = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                type ClipboardItemConstructor = new (items: Record<string, Blob>) => ClipboardItem;
                const ClipboardItemCtor = (window as Window & { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem;
                if (!ClipboardItemCtor) {
                    alert(t("page.stickerMaker.errors.clipboardUnsupported"));
                    return;
                }
                await navigator.clipboard.write([
                    new ClipboardItemCtor({ "image/png": blob }),
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch {
            alert(t("page.stickerMaker.errors.copyFailed"));
        }
    };

    return (
        <MainLayout>
            <div className="pt-4 min-h-screen pb-12">
                <div className="container mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                            <span className="hh-label text-miku">{t("page.stickerMaker.badge")}</span>
                        </div>
                        <h1 className="hh-display text-3xl sm:text-4xl text-primary-text">
                            {t("page.stickerMaker.title")} <span className="text-miku">{t("page.stickerMaker.titleHighlight")}</span>
                        </h1>
                        <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                            {t("page.stickerMaker.description")}
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                        {/* Left Sidebar: Filters & Selection */}
                        <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
                            {/* Unit Filter */}
                            <div className="hh-tile p-5 rounded-[var(--hh-radius-lg)]">
                                <h3 className="hh-label mb-3 px-1">{t("page.stickerMaker.sections.unitFilter")}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {UNIT_DATA.map(unit => {
                                        const iconName = UNIT_ICON_FILES[unit.id] || "";
                                        const unitLabel = t(UNIT_ID_LABEL_KEYS[unit.id] ?? `common.units.${unit.id}`);
                                        return (
                                            <button
                                                key={unit.id}
                                                onClick={() => handleUnitClick(unit.id)}
                                                className={`hh-press hh-focusable p-1.5 rounded-[var(--hh-radius-md)] border ${selectedUnitIds.includes(unit.id)
                                                    ? "border-[var(--hh-accent)] bg-[var(--hh-accent-wash-strong)]"
                                                    : "border-transparent hover:bg-[var(--hh-surface-sunken)]"
                                                    }`}
                                                title={unitLabel}
                                            >
                                                <div className="w-8 h-8 relative">
                                                    <NextImage
                                                        src={`/data/icon/${iconName}`}
                                                        alt={unitLabel}
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Character Filter */}
                            <div className="hh-tile p-5 rounded-[var(--hh-radius-lg)]">
                                <h3 className="hh-label mb-3 px-1">{t("page.stickerMaker.sections.characterSelect")}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {availableCharacterIds.map(charId => {
                                        const characterName = getCharacterName(t, charId);
                                        return (
                                            <button
                                                key={charId}
                                                onClick={() => handleCharacterClick(charId)}
                                                className={`hh-press hh-focusable relative rounded-full ${selectedCharacterId === charId
                                                    ? "ring-2 ring-[var(--hh-accent)] z-10"
                                                    : "ring-2 ring-transparent opacity-80 hover:opacity-100 grayscale hover:grayscale-0"
                                                    }`}
                                                title={characterName}
                                            >
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--hh-surface-sunken)]">
                                                    <NextImage
                                                        src={getCharacterIconUrl(charId)}
                                                        alt={characterName}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                             {/* Sticker Grid */}
                             {selectedCharacterId && (
                                 <div className="hh-tile p-5 rounded-[var(--hh-radius-lg)]">
                                     <h3 className="hh-label mb-3 px-1">
                                         {t("page.stickerMaker.sections.stickerSelect", { count: formatNumber(filteredStickers.length) })}
                                     </h3>
                                     <div className="max-h-[400px] overflow-y-auto pr-1 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                                         <div className="grid grid-cols-3 gap-2">
                                             {/* Custom Upload Button */}
                                             <button
                                                 onClick={() => stickerFileInputRef.current?.click()}
                                                 className="hh-press hh-focusable relative rounded-[var(--hh-radius-md)] overflow-hidden border-2 border-dashed border-[var(--hh-border-strong)] hover:border-[var(--hh-accent)] flex flex-col items-center justify-center gap-1 aspect-[296/256] text-[var(--hh-text-tertiary)] hover:text-miku"
                                                 title={t("page.stickerMaker.uploadCustomImageTitle")}
                                             >
                                                 <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                 </svg>
                                                 <span className="text-xs font-bold">{t("page.stickerMaker.uploadImage")}</span>
                                             </button>
                                             <input
                                                 type="file"
                                                 accept="image/*"
                                                 ref={stickerFileInputRef}
                                                 className="hidden"
                                                 onChange={handleStickerUpload}
                                             />
 
                                             {filteredStickers.map((sticker) => (
                                                 <button
                                                     key={sticker.id}
                                                     onClick={() => handleStickerClick(sticker)}
                                                     className={`hh-press hh-focusable relative rounded-[var(--hh-radius-md)] overflow-hidden border-2 ${selectedSticker?.id === sticker.id
                                                         ? "border-[var(--hh-accent)]"
                                                         : "border-transparent hover:border-[var(--hh-border-strong)]"
                                                         }`}
                                                 >
                                                     <img
                                                         src={`${STICKER_MAKER_BASE_URL}/img/${sticker.img}`}
                                                         alt={sticker.name}
                                                         loading="lazy"
                                                         className="w-full aspect-[296/256] object-contain bg-[var(--hh-surface-sunken)]"
                                                     />
                                                 </button>
                                             ))}
                                         </div>
                                     </div>
                                 </div>
                             )}
                         </div>
 
                         {/* Right Area: Editor */}
                         <div className="flex-1" ref={editorRef}>
                             {!selectedSticker ? (
                                 <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-[var(--hh-text-tertiary)] hh-well border-dashed p-8 rounded-[var(--hh-radius-xl)]">
                                     <div className="w-16 h-16 mb-4 opacity-20">
                                         <svg fill="currentColor" viewBox="0 0 24 24">
                                             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                         </svg>
                                     </div>
                                     <p className="hh-title text-lg">{t("page.stickerMaker.emptyTitle")}</p>
                                     <p className="hh-body text-sm mt-1">{t("page.stickerMaker.emptyDescription")}</p>
                                 </div>
                             ) : (
                                 <div className="hh-tile rounded-[var(--hh-radius-xl)] p-6 lg:p-8 sticker-editor-container grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Canvas Area */}
                                    <div className="flex flex-col items-center gap-6 order-2 md:order-1 md:col-span-2 mt-4 md:mt-0 mb-4 md:mb-8">
                                        <div className="relative group">
                                            {/* Canvas Wrapper */}
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="relative overflow-hidden rounded-[var(--hh-radius-md)] border-4 border-[var(--hh-surface-2)] bg-[var(--hh-surface-sunken)] shadow-[var(--hh-shadow-raised)]"
                                                    style={{ width: 296, height: 256 }}
                                                >
                                                    <canvas
                                                        ref={canvasRef}
                                                        width={296}
                                                        height={256}
                                                        className="block"
                                                    />
                                                </div>

                                                 {/* Vertical Y Control */}
                                                 <div className="h-[256px] py-4 w-8 flex justify-center rounded-[var(--hh-radius-full)] border border-[var(--hh-border-hairline)] bg-[var(--hh-surface-sunken)]">
                                                     <input
                                                         type="range"
                                                         min={0}
                                                         max={256}
                                                         step={1}
                                                         value={curve ? 256 - position.y + fontSize * 3 : 256 - position.y}
                                                         onChange={(e) =>
                                                             setPosition({
                                                                 ...position,
                                                                 y: curve
                                                                     ? 256 + fontSize * 3 - Number(e.target.value)
                                                                     : 256 - Number(e.target.value),
                                                             })
                                                         }
                                                         onPointerDown={() => {
                                                             if (document.activeElement instanceof HTMLElement) {
                                                                 document.activeElement.blur();
                                                             }
                                                         }}
                                                         className="h-full accent-miku cursor-pointer w-2"
                                                         style={{
                                                             writingMode: "vertical-lr",
                                                             direction: "rtl",
                                                             WebkitAppearance: "slider-vertical",
                                                         }}
                                                     />
                                                 </div>
                                             </div>
 
                                             {/* Horizontal X Control */}
                                             <div className="mt-4 w-[296px]">
                                                 <input
                                                     type="range"
                                                     min={0}
                                                     max={296}
                                                     step={1}
                                                     value={position.x}
                                                     onChange={(e) =>
                                                         setPosition({ ...position, x: Number(e.target.value) })
                                                     }
                                                     onPointerDown={() => {
                                                         if (document.activeElement instanceof HTMLElement) {
                                                             document.activeElement.blur();
                                                         }
                                                     }}
                                                     className="w-full h-2 bg-[var(--hh-surface-sunken)] rounded-[var(--hh-radius-full)] appearance-none cursor-pointer accent-miku"
                                                 />
                                             </div>
                                        </div>
                                    </div>

                                    {/* Text & Font Controls */}
                                    <div className="space-y-4 order-1 md:order-2">
                                         <div>
                                             <label className="hh-label block mb-2">
                                                 {t("page.stickerMaker.textContent")}
                                             </label>
                                             <textarea
                                                 value={text}
                                                 onChange={(e) => setText(e.target.value)}
                                                 rows={3}
                                                 className="hh-input w-full px-4 py-3 text-base resize-none"
                                                 placeholder={t("page.stickerMaker.textPlaceholder")}
                                             />
                                         </div>
                                         <div>
                                             <label className="hh-label block mb-2">
                                                 {t("page.stickerMaker.fontSelect")}
                                             </label>
                                             <div className="grid grid-cols-2 gap-2">
                                                 {allFonts.map(font => (
                                                     <button
                                                         key={font.name}
                                                         onClick={() => setFontFamily(font.name)}
                                                         className={`hh-press hh-focusable px-3 py-2 text-sm rounded-[var(--hh-radius-md)] border truncate ${fontFamily === font.name
                                                            ? "border-[var(--hh-accent)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] font-bold"
                                                            : "border-[var(--hh-border)] bg-[var(--hh-surface-2)] text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-3)] hover:text-[var(--hh-text-primary)]"
                                                             }`}
                                                         title={font.labelKey ? t(font.labelKey) : font.label}
                                                     >
                                                         {font.labelKey ? t(font.labelKey) : font.label}
                                                     </button>
                                                 ))}
 
                                                 {/* Custom Font Upload Button */}
                                                 <button
                                                     onClick={() => fileInputRef.current?.click()}
                                                     className="hh-press hh-focusable px-3 py-2 text-sm rounded-[var(--hh-radius-md)] border border-dashed border-[var(--hh-border-strong)] text-[var(--hh-text-secondary)] hover:border-[var(--hh-accent)] hover:text-miku flex items-center justify-center gap-1"
                                                 >
                                                     <span className="text-lg">+</span> {t("page.stickerMaker.customFont")}
                                                 </button>
                                                 <input
                                                     type="file"
                                                     accept=".ttf,.otf,.woff,.woff2"
                                                     ref={fileInputRef}
                                                     className="hidden"
                                                     onChange={handleFontUpload}
                                                 />
                                             </div>
                                         </div>
                                     </div>
 
                                     {/* Param Sliders */}
                                     <div className="space-y-5 hh-well p-5 order-3 md:order-3">
                                        <RangeSlider
                                            label={t("page.stickerMaker.sliders.rotate")}
                                            value={rotate}
                                            onChange={setRotate}
                                            min={-10}
                                            max={10}
                                            step={0.2}
                                        />
                                        <RangeSlider
                                            label={t("page.stickerMaker.sliders.fontSize")}
                                            value={fontSize}
                                            onChange={setFontSize}
                                            min={10}
                                            max={100}
                                        />
                                        <RangeSlider
                                            label={t("page.stickerMaker.sliders.lineSpacing")}
                                            value={spaceSize}
                                            onChange={setSpaceSize}
                                            min={18}
                                            max={100}
                                        />
                                        <RangeSlider
                                            label={t("page.stickerMaker.sliders.charSpacing")}
                                            value={charSpacing}
                                            onChange={setCharSpacing}
                                            min={-10}
                                            max={50}
                                            step={0.5}
                                        />

                                       <div className="flex items-center justify-between pt-2 border-t border-[var(--hh-border)]">
                                           <span className="hh-label">
                                               {t("page.stickerMaker.curveText")}
                                           </span>
                                           <button
                                               onClick={() => setCurve(!curve)}
                                               className={`hh-switch hh-focusable ${curve ? "hh-switch-active" : ""}`}
                                               role="switch"
                                               aria-checked={curve}
                                           >
                                               <span className="hh-switch-thumb" />
                                           </button>
                                       </div>

                                       <div className="flex items-center gap-2 pt-2 border-t border-[var(--hh-border)]">
                                           <span className="hh-label whitespace-nowrap">{t("page.stickerMaker.textColor")}</span>
                                           <label className="relative w-7 h-7 rounded-full border-2 border-[var(--hh-border)] cursor-pointer overflow-hidden flex-shrink-0 hover:border-[var(--hh-accent)] transition-colors" title={t("page.stickerMaker.chooseTextColor")}>
                                                <div
                                                    className="absolute inset-0 rounded-full"
                                                    style={{ backgroundColor: textColor || selectedSticker?.color }}
                                                />
                                                <input
                                                    type="color"
                                                    value={textColor || selectedSticker?.color || '#000000'}
                                                    onChange={(e) => setTextColor(e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                />
                                            </label>
                                           <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)]">
                                               {textColor || selectedSticker?.color}
                                           </span>
                                           {textColor && (
                                               <button
                                                   onClick={() => setTextColor("")}
                                                   className="text-xs text-[var(--hh-text-tertiary)] hover:text-miku transition-colors whitespace-nowrap"
                                                    title={t("page.stickerMaker.resetDefaultColor")}
                                                >
                                                    {t("page.stickerMaker.reset")}
                                                </button>
                                            )}
                                        </div>

                                         <div className="flex items-center justify-between pt-2 border-t border-[var(--hh-border)]">
                                             <span className="hh-label">
                                                 {t("page.stickerMaker.backgroundColor")}
                                             </span>
                                             {/* Shrink-to-fit: .hh-segment defaults to flex:1 1 auto for the side
                                                 rail, which would eat this row's label. */}
                                             <div className="hh-segment w-auto grow-0 shrink-0" role="tablist">
                                                 <button
                                                     onClick={() => setBgColor("transparent")}
                                                     className="hh-segment-item hh-focusable"
                                                     role="tab"
                                                     aria-selected={bgColor === "transparent"}
                                                 >
                                                     {t("page.stickerMaker.transparent")}
                                                 </button>
                                                 <button
                                                     onClick={() => setBgColor("white")}
                                                     className="hh-segment-item hh-focusable"
                                                     role="tab"
                                                     aria-selected={bgColor === "white"}
                                                 >
                                                     {t("page.stickerMaker.white")}
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
 
                                     {/* Action Buttons */}
                                     <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-[var(--hh-border)] order-4 md:order-4 md:col-span-2">
                                         <button
                                             onClick={handleCopy}
                                             /* .hh-btn's own padding is unlayered and beats Tailwind's
                                                padding utilities, so the larger action-button sizing
                                                has to be inline. */
                                             style={{ padding: "0.75rem 1.5rem" }}
                                             className="hh-btn hh-press hh-focusable font-bold"
                                         >
                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                             </svg>
                                             {copied ? t("page.stickerMaker.copied") : t("page.stickerMaker.copyImage")}
                                         </button>
 
                                         <button
                                             onClick={handleDownload}
                                             style={{ padding: "0.75rem 2rem" }}
                                             className="hh-btn hh-btn-primary hh-press hh-focusable font-bold"
                                         >
                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                             </svg>
                                             {t("page.stickerMaker.downloadImage")}
                                         </button>
                                     </div>
                                 </div>
                             )}
                        </div>
                    </div>

                    {/* Footer / Credits */}
                    <div className="mt-12 pt-8 border-t border-[var(--hh-border)] text-center text-[var(--hh-text-tertiary)] text-sm space-y-2">
                        <p>
                            {t("page.stickerMaker.credits.sourcePrefix")}{" "}
                            <ExternalLink
                                href="https://github.com/TheOriginalAyaka/sekai-stickers"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-miku hover:underline"
                            >
                                sekai-stickers (TheOriginalAyaka)
                            </ExternalLink>
                        </p>
                        <p>
                            {t("page.stickerMaker.credits.fontLicensePrefix")} <ExternalLink href="https://scripts.sil.org/OFL" target="_blank" rel="noopener noreferrer" className="hover:underline">SIL Open Font License 1.1</ExternalLink>{t("page.stickerMaker.credits.fontLicenseSuffix") ? ` ${t("page.stickerMaker.credits.fontLicenseSuffix")}` : ""}
                        </p>
                        <p className="text-xs text-[var(--hh-text-tertiary)] mt-4">
                            {t("page.stickerMaker.credits.localNotice")}
                        </p>
                    </div>
                </div>
            </div >
        </MainLayout >
    );
}
