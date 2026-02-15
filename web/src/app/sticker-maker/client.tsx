"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import ExternalLink from "@/components/ExternalLink";
import MainLayout from "@/components/MainLayout";
import { UNIT_DATA, CHARACTER_NAMES, SUPPORT_UNIT_NAMES, SupportUnit } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";

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

// Character Name mapping for display (fallback)
const CHAR_DISPLAY_NAMES: Record<string, string> = {
    "ichika": "星乃一歌", "saki": "天馬咲希", "honami": "望月穂波", "shiho": "日野森志歩",
    "minori": "花里みのり", "haruka": "桐谷遥", "airi": "桃井愛莉", "shizuku": "日野森雫",
    "kohane": "小豆沢こはね", "an": "白石杏", "akito": "東雲彰人", "toya": "青柳冬弥",
    "tsukasa": "天馬司", "emu": "鳳えむ", "nene": "草薙寧々", "rui": "神代類",
    "kanade": "宵崎奏", "mafuyu": "朝比奈まふゆ", "ena": "東雲絵名", "mizuki": "暁山瑞希",
    "miku": "初音ミク", "rin": "鏡音リン", "len": "鏡音レン", "luka": "巡音ルカ",
    "meiko": "MEIKO", "kaito": "KAITO"
};

const UNIT_ICONS: Record<string, string> = {
    "ln": "ln.webp",
    "mmj": "mmj.webp",
    "vbs": "vbs.webp",
    "ws": "wxs.webp",
    "25ji": "n25.webp",
    "vs": "vs.webp",
};

// Available Fonts
const DEFAULT_FONTS = [
    { name: "MaokenAssortedSans", label: "猫啃什锦黑", file: "MaokenAssortedSans-Lite.ttf" },
];

interface FontOption {
    name: string;
    label: string;
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
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap min-w-[4rem]">
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
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-miku
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-miku [&::-webkit-slider-thumb]:shadow-md
                    [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
            />
            <span className="text-xs font-mono text-slate-400 min-w-[2rem] text-right">
                {typeof value === "number" ? (Number.isInteger(step) ? value : value.toFixed(1)) : value}
            </span>
        </div>
    );
}

// ==================== Main StickerMakerContent ====================
export default function StickerMakerContent() {
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

    // Load characters.json
    useEffect(() => {
        fetch(`/sticker-maker/characters.json?v=${new Date().getTime()}`)
            .then((r) => r.json())
            .then((data: CharacterData[]) => {
                setAllStickers(data);
            });
    }, []);

    // Load fonts
    useEffect(() => {
        const loadFonts = async () => {
            const fontPromises = DEFAULT_FONTS.filter(f => f.file).map(async (font) => {
                const f = new FontFace(font.name, `url(/sticker-maker/fonts/${font.file})`);
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
            alert("字体加载失败，请重试");
        }
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
        setText(sticker.defaultText.text === "text" ? "这是一串文字" : sticker.defaultText.text);
        setPosition({ x: sticker.defaultText.x, y: sticker.defaultText.y });
        setRotate(sticker.defaultText.r);
        setFontSize(sticker.defaultText.s);
        setSpaceSize(1);
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
        img.src = `/sticker-maker/img/${sticker.img}`;
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
        ctx.fillStyle = selectedSticker.color;

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
    }, [loaded, fontsReady, selectedSticker, text, position, fontSize, spaceSize, charSpacing, rotate, curve, fontFamily, bgColor]);

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
                // Fix: explicit any cast for ClipboardItem if not defined
                const ClipboardItem = (window as any).ClipboardItem;
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch {
            alert("复制失败，请尝试使用下载功能");
        }
    };

    return (
        <MainLayout activeNav="表情包制作">
            <div className="pt-4 min-h-screen pb-12">
                <div className="container mx-auto px-4 py-8">
                    {/* Page Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                            <span className="text-miku text-xs font-bold tracking-widest uppercase">Creativity Tool</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                            表情包 <span className="text-miku">制作器</span>
                        </h1>
                        <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                            选择角色，输入文字，制作你的专属 Sekai 表情包
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                        {/* Left Sidebar: Filters & Selection */}
                        <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
                            {/* Unit Filter */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-500 mb-3 px-1">筛选团体</h3>
                                <div className="flex flex-wrap gap-2">
                                    {UNIT_DATA.map(unit => {
                                        const iconName = UNIT_ICONS[unit.id] || "";
                                        return (
                                            <button
                                                key={unit.id}
                                                onClick={() => handleUnitClick(unit.id)}
                                                className={`p-1.5 rounded-xl transition-all ${selectedUnitIds.includes(unit.id)
                                                    ? "ring-2 ring-miku shadow-lg bg-white"
                                                    : "hover:bg-slate-100/50 border border-transparent"
                                                    }`}
                                                title={unit.name}
                                            >
                                                <div className="w-8 h-8 relative">
                                                    <NextImage
                                                        src={`/data/icon/${iconName}`}
                                                        alt={unit.name}
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
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-500 mb-3 px-1">选择角色</h3>
                                <div className="flex flex-wrap gap-2">
                                    {availableCharacterIds.map(charId => (
                                        <button
                                            key={charId}
                                            onClick={() => handleCharacterClick(charId)}
                                            className={`relative transition-all ${selectedCharacterId === charId
                                                ? "ring-2 ring-miku scale-110 z-10 rounded-full shadow-md"
                                                : "ring-2 ring-transparent hover:ring-slate-200/50 rounded-full opacity-80 hover:opacity-100 grayscale hover:grayscale-0"
                                                }`}
                                            title={CHARACTER_NAMES[charId]}
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                                                <NextImage
                                                    src={getCharacterIconUrl(charId)}
                                                    alt={CHARACTER_NAMES[charId]}
                                                    width={40}
                                                    height={40}
                                                    className="w-full h-full object-cover"
                                                    unoptimized
                                                />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sticker Grid */}
                            {selectedCharacterId && (
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-100">
                                    <h3 className="text-sm font-bold text-slate-500 mb-3 px-1">
                                        选择底图 ({filteredStickers.length})
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                        {filteredStickers.map((sticker) => (
                                            <button
                                                key={sticker.id}
                                                onClick={() => handleStickerClick(sticker)}
                                                className={`relative rounded-lg overflow-hidden transition-all border-2 ${selectedSticker?.id === sticker.id
                                                    ? "border-miku shadow-md"
                                                    : "border-transparent hover:border-slate-200"
                                                    }`}
                                            >
                                                <img
                                                    src={`/sticker-maker/img/${sticker.img}`}
                                                    alt={sticker.name}
                                                    loading="lazy"
                                                    className="w-full aspect-[296/256] object-contain bg-slate-50/50"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Area: Editor */}
                        <div className="flex-1" ref={editorRef}>
                            {!selectedSticker ? (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-100 shadow-sm border-dashed">
                                    <div className="w-16 h-16 mb-4 opacity-20">
                                        <svg fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                        </svg>
                                    </div>
                                    <p className="text-lg font-medium">请先选择角色和表情包样式</p>
                                    <p className="text-sm mt-1">点击左侧头像开始制作</p>
                                </div>
                            ) : (
                                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 sticker-editor-container grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Canvas Area */}
                                    <div className="flex flex-col items-center gap-6 order-2 md:order-1 md:col-span-2 mt-4 md:mt-0 mb-4 md:mb-8">
                                        <div className="relative group">
                                            {/* Canvas Wrapper */}
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="rounded-xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100 relative"
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
                                                <div className="h-[256px] py-4 bg-slate-50 rounded-full w-8 flex justify-center border border-slate-100">
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
                                                    className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-miku"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Text & Font Controls */}
                                    <div className="space-y-4 order-1 md:order-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                                文本内容
                                            </label>
                                            <textarea
                                                value={text}
                                                onChange={(e) => setText(e.target.value)}
                                                rows={3}
                                                className="w-full px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku resize-none bg-slate-50"
                                                placeholder="输入文字..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">
                                                字体选择
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {allFonts.map(font => (
                                                    <button
                                                        key={font.name}
                                                        onClick={() => setFontFamily(font.name)}
                                                        className={`px-3 py-2 text-sm rounded-lg border transition-all truncate ${fontFamily === font.name
                                                            ? "border-miku bg-miku/5 text-miku font-bold"
                                                            : "border-slate-200 hover:border-slate-300 text-slate-600"
                                                            }`}
                                                        title={font.label}
                                                    >
                                                        {font.label}
                                                    </button>
                                                ))}

                                                {/* Custom Font Upload Button */}
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-3 py-2 text-sm rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-miku hover:text-miku hover:bg-white transition-all flex items-center justify-center gap-1"
                                                >
                                                    <span className="text-lg">+</span> 自定义字体
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
                                    <div className="space-y-5 bg-slate-50 p-5 rounded-xl border border-slate-100 order-3 md:order-3">
                                        <RangeSlider
                                            label="旋转"
                                            value={rotate}
                                            onChange={setRotate}
                                            min={-10}
                                            max={10}
                                            step={0.2}
                                        />
                                        <RangeSlider
                                            label="字号"
                                            value={fontSize}
                                            onChange={setFontSize}
                                            min={10}
                                            max={100}
                                        />
                                        <RangeSlider
                                            label="行间距"
                                            value={spaceSize}
                                            onChange={setSpaceSize}
                                            min={18}
                                            max={100}
                                        />
                                        <RangeSlider
                                            label="字间距"
                                            value={charSpacing}
                                            onChange={setCharSpacing}
                                            min={-10}
                                            max={50}
                                            step={0.5}
                                        />

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                            <span className="text-xs font-bold text-slate-500">
                                                弧形文字 (Beta)
                                            </span>
                                            <button
                                                onClick={() => setCurve(!curve)}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${curve ? "bg-miku" : "bg-slate-300"
                                                    }`}
                                            >
                                                <span
                                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${curve ? "translate-x-5" : ""
                                                        }`}
                                                />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                            <span className="text-xs font-bold text-slate-500">角色颜色:</span>
                                            <div
                                                className="w-5 h-5 rounded-full border border-slate-200 shadow-sm"
                                                style={{ backgroundColor: selectedSticker?.color }}
                                            />
                                            <span className="text-xs font-mono text-slate-400">
                                                {selectedSticker?.color}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                            <span className="text-xs font-bold text-slate-500">
                                                背景颜色
                                            </span>
                                            <div className="flex bg-slate-200 rounded-lg p-1 gap-1">
                                                <button
                                                    onClick={() => setBgColor("transparent")}
                                                    className={`px-3 py-1 text-xs rounded-md transition-all ${bgColor === "transparent"
                                                        ? "bg-white text-slate-700 shadow-sm font-bold"
                                                        : "text-slate-500 hover:text-slate-700"
                                                        }`}
                                                >
                                                    透明
                                                </button>
                                                <button
                                                    onClick={() => setBgColor("white")}
                                                    className={`px-3 py-1 text-xs rounded-md transition-all ${bgColor === "white"
                                                        ? "bg-white text-slate-700 shadow-sm font-bold"
                                                        : "text-slate-500 hover:text-slate-700"
                                                        }`}
                                                >
                                                    白色
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-slate-100 order-4 md:order-4 md:col-span-2">
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 hover:border-miku hover:text-miku transition-all shadow-sm"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            {copied ? "已复制 ✓" : "复制图片"}
                                        </button>

                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-miku to-miku-dark text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            下载图片
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer / Credits */}
                    <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm space-y-2">
                        <p>
                            表情包制作器源代码参考{" "}
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
                            猫啃什锦黑 由 <ExternalLink href="https://scripts.sil.org/OFL" target="_blank" rel="noopener noreferrer" className="hover:underline">SIL Open Font License 1.1</ExternalLink> 授权
                        </p>
                        <p className="text-xs text-slate-300 mt-4">
                            表情包制作器为完全本地运行 自行载入字体并以商用目的制作产生的后果用户自行承担
                        </p>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
