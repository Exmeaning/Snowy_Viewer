"use client";

const EXTENSION_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
};

function sanitizeFileName(fileName: string): string {
    const trimmed = fileName.trim();
    const fallback = "image";
    const safeBase = (trimmed || fallback)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 120);

    return safeBase || fallback;
}

function ensureFileExtension(fileName: string, mimeType: string): string {
    if (/\.[a-zA-Z0-9]+$/.test(fileName)) {
        return fileName;
    }
    const ext = EXTENSION_BY_MIME[mimeType] || "png";
    return `${fileName}.${ext}`;
}

function toAbsoluteUrl(imageUrl: string): string {
    return new URL(imageUrl, window.location.href).toString();
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
                return;
            }
            reject(new Error("Failed to read image blob"));
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read image blob"));
        reader.readAsDataURL(blob);
    });
}

async function fetchImageBlobDirect(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Image request failed: ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) {
        throw new Error("Response is not an image");
    }

    return blob;
}

export async function fetchImageBlob(imageUrl: string): Promise<Blob> {
    if (typeof window === "undefined") {
        throw new Error("Image actions are only available in browser");
    }

    const absoluteUrl = toAbsoluteUrl(imageUrl);
    return fetchImageBlobDirect(absoluteUrl);
}

export async function createSvgImageBlob(svgElement: SVGSVGElement): Promise<Blob> {
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    if (!clonedSvg.getAttribute("width") || !clonedSvg.getAttribute("height")) {
        const viewBox = svgElement.viewBox.baseVal;
        if (viewBox?.width && viewBox?.height) {
            clonedSvg.setAttribute("width", String(viewBox.width));
            clonedSvg.setAttribute("height", String(viewBox.height));
        }
    }

    const imageNodes = Array.from(clonedSvg.querySelectorAll("image"));
    await Promise.all(imageNodes.map(async imageNode => {
        const href = imageNode.getAttribute("href")
            || imageNode.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (!href || href.startsWith("data:")) {
            return;
        }

        const absoluteUrl = toAbsoluteUrl(href);
        try {
            const blob = await fetchImageBlobDirect(absoluteUrl);
            const dataUrl = await blobToDataUrl(blob);
            imageNode.setAttribute("href", dataUrl);
            imageNode.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
        } catch {
            imageNode.setAttribute("href", absoluteUrl);
            imageNode.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", absoluteUrl);
        }
    }));

    const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
    return new Blob([serializedSvg], { type: "image/svg+xml" });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Failed to load svg preview"));
        };
        image.src = objectUrl;
    });
}

async function rasterizeSvgBlob(svgBlob: Blob): Promise<Blob> {
    const image = await loadImageFromBlob(svgBlob);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
        throw new Error("Invalid svg preview size");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context is not available");
    }

    context.drawImage(image, 0, 0, width, height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("Failed to export png preview"));
                return;
            }
            resolve(blob);
        }, "image/png");
    });
}

export async function createSvgPreviewBlob(svgElement: SVGSVGElement): Promise<Blob> {
    const svgBlob = await createSvgImageBlob(svgElement);

    try {
        return await rasterizeSvgBlob(svgBlob);
    } catch {
        return svgBlob;
    }
}

export async function saveImageBlob(blob: Blob, fileName: string): Promise<void> {
    const safeName = ensureFileExtension(sanitizeFileName(fileName), blob.type);

    const objectUrl = URL.createObjectURL(blob);
    try {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = safeName;
        link.click();
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export async function copyImageBlob(blob: Blob): Promise<void> {
    if (!navigator.clipboard?.write) {
        throw new Error("Clipboard API is not supported");
    }

    type ClipboardItemConstructor = new (items: Record<string, Blob>) => ClipboardItem;
    const ClipboardItemCtor = (window as Window & { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem;
    if (!ClipboardItemCtor) {
        throw new Error("ClipboardItem is not supported");
    }

    const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png";

    await navigator.clipboard.write([
        new ClipboardItemCtor({ [mimeType]: blob }),
    ]);
}

export async function saveImageFromUrl(
    imageUrl: string,
    fileName: string,
): Promise<void> {
    const blob = await fetchImageBlob(imageUrl);
    await saveImageBlob(blob, fileName);
}

export async function copyImageFromUrl(imageUrl: string): Promise<void> {
    const blob = await fetchImageBlob(imageUrl);
    await copyImageBlob(blob);
}
