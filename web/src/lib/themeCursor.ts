/**
 * Handheld UI / Console-OS Dynamic Cursor System
 *
 * Generates razor-sharp, high-contrast, theme-reactive SVG pointers
 * with dual-tone contours and accent highlights tailored to the active character theme color.
 */

export type ThemeCursorType =
    | "default"
    | "pointer"
    | "text"
    | "grab"
    | "grabbing"
    | "not-allowed"
    | "help"
    | "zoom-in"
    | "zoom-out";

export const DEFAULT_THEME_CURSOR_COLOR = "#33ccbb";

interface CursorConfig {
    hotspot: [number, number];
    fallback: string;
    svg: (color: string) => string;
}

const CURSOR_CONFIGS: Record<ThemeCursorType, CursorConfig> = {
    default: {
        hotspot: [2, 2],
        fallback: "default",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-def" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-def)">
    <path d="M2.5 2L18.5 9.8L11.5 12.2L15.2 20.2L12 21.8L8.2 13.8L2.5 18.5Z" fill="#0D1117" stroke="#0D1117" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M3.8 3.6L16.6 9.8L10.8 11.8L14.2 19L12.3 19.9L8.8 12.9L3.8 16.8Z" fill="#FFFFFF"/>
    <polygon points="3.8,3.6 10.2,6.7 6.8,10.2" fill="${color}"/>
    <circle cx="10.8" cy="11.8" r="1.1" fill="${color}"/>
  </g>
</svg>`,
    },
    pointer: {
        hotspot: [7, 1],
        fallback: "pointer",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-ptr" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-ptr)">
    <path d="M7.5 1.5C6.4 1.5 5.5 2.4 5.5 3.5V11L4 10.1C3.1 9.5 1.9 9.8 1.4 10.7C0.9 11.6 1.2 12.8 2.2 13.3L6.5 16.2C7 16.5 7.4 17.2 7.4 18V21.5C7.4 22 7.8 22.5 8.4 22.5H16.5C17.6 22.5 18.5 21.6 18.5 20.5V12C18.5 10.9 17.6 10 16.5 10C16.3 10 16.1 10.05 15.9 10.1C15.6 9.2 14.8 8.5 13.8 8.5C13.5 8.5 13.3 8.55 13.1 8.65C12.8 7.8 12 7.2 11 7.2C10.8 7.2 10.6 7.25 10.4 7.3V3.5C10.4 2.4 9.5 1.5 8.4 1.5H7.5Z" fill="#0D1117" stroke="#0D1117" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M7.5 2.5C7 2.5 6.5 3 6.5 3.5V11.8L4.8 10.9C4.2 10.5 3.5 10.7 3.2 11.3C2.9 11.9 3.1 12.6 3.7 13L8 15.8C8.6 16.2 9 17 9 17.8V21.2H16C16.6 21.2 17.2 20.7 17.2 20V12C17.2 11.4 16.7 11 16 11H14.8V10.2C14.8 9.6 14.3 9.2 13.6 9.2H12.6V9C12.6 8.4 12.1 8 11.4 8H10.4V3.5C10.4 3 9.9 2.5 9.4 2.5H7.5Z" fill="#FFFFFF"/>
    <rect x="6.8" y="4.5" width="2.4" height="4" rx="1.2" fill="${color}"/>
    <rect x="9.2" y="18.8" width="6.6" height="2.2" rx="0.8" fill="${color}"/>
  </g>
</svg>`,
    },
    text: {
        hotspot: [12, 12],
        fallback: "text",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-txt" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.5" dy="1" stdDeviation="0.8" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-txt)">
    <path d="M7 4H17M7 20H17M12 4V20" stroke="#0D1117" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M7.5 4H16.5M7.5 20H16.5M12 4.5V19.5" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2.2" fill="${color}" stroke="#0D1117" stroke-width="0.8"/>
    <circle cx="12" cy="4" r="1.2" fill="${color}"/>
    <circle cx="12" cy="20" r="1.2" fill="${color}"/>
  </g>
</svg>`,
    },
    grab: {
        hotspot: [11, 11],
        fallback: "grab",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-grab" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-grab)">
    <circle cx="11.5" cy="11.5" r="7.5" fill="#0D1117" stroke="#0D1117" stroke-width="1"/>
    <circle cx="11.5" cy="11.5" r="6" fill="#FFFFFF"/>
    <circle cx="11.5" cy="11.5" r="3.6" fill="${color}"/>
    <circle cx="11.5" cy="11.5" r="1.5" fill="#FFFFFF"/>
  </g>
</svg>`,
    },
    grabbing: {
        hotspot: [11, 11],
        fallback: "grabbing",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-grabbing" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-grabbing)">
    <circle cx="11.5" cy="11.5" r="6.5" fill="#0D1117" stroke="#0D1117" stroke-width="1"/>
    <circle cx="11.5" cy="11.5" r="5" fill="${color}"/>
    <circle cx="11.5" cy="11.5" r="1.8" fill="#FFFFFF"/>
  </g>
</svg>`,
    },
    "not-allowed": {
        hotspot: [11, 11],
        fallback: "not-allowed",
        svg: () => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-na" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-na)">
    <circle cx="11.5" cy="11.5" r="8" fill="#0D1117" stroke="#0D1117" stroke-width="1"/>
    <circle cx="11.5" cy="11.5" r="6.6" fill="#FFFFFF"/>
    <circle cx="11.5" cy="11.5" r="5.2" fill="none" stroke="#E05666" stroke-width="2"/>
    <line x1="7.8" y1="7.8" x2="15.2" y2="15.2" stroke="#E05666" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`,
    },
    help: {
        hotspot: [2, 2],
        fallback: "help",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-help" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-help)">
    <path d="M2.5 2L14.5 8L9.5 10L7.5 15.5L2.5 2Z" fill="#0D1117" stroke="#0D1117" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M3.6 3.4L13.2 8.2L9.2 9.8L7.5 14.3L3.6 3.4Z" fill="#FFFFFF"/>
    <polygon points="3.6,3.4 8.2,5.6 6,7.8" fill="${color}"/>
    <circle cx="16.5" cy="14.5" r="5" fill="#0D1117"/>
    <circle cx="16.5" cy="14.5" r="3.8" fill="${color}"/>
    <text x="16.5" y="17" font-size="7.5" font-weight="900" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" fill="#FFFFFF">?</text>
  </g>
</svg>`,
    },
    "zoom-in": {
        hotspot: [9, 9],
        fallback: "zoom-in",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-zi" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-zi)">
    <path d="M14.5 14.5L20.5 20.5" stroke="#0D1117" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14.5 14.5L20.5 20.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="9.5" cy="9.5" r="7" fill="#0D1117" stroke="#0D1117" stroke-width="1"/>
    <circle cx="9.5" cy="9.5" r="5.5" fill="#FFFFFF"/>
    <path d="M6.5 9.5H12.5M9.5 6.5V12.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`,
    },
    "zoom-out": {
        hotspot: [9, 9],
        fallback: "zoom-out",
        svg: (color) => `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <filter id="hh-shadow-zo" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0.8" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>
  <g filter="url(#hh-shadow-zo)">
    <path d="M14.5 14.5L20.5 20.5" stroke="#0D1117" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14.5 14.5L20.5 20.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="9.5" cy="9.5" r="7" fill="#0D1117" stroke="#0D1117" stroke-width="1"/>
    <circle cx="9.5" cy="9.5" r="5.5" fill="#FFFFFF"/>
    <path d="M6.5 9.5H12.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`,
    },
};

/**
 * Encodes SVG string to standard Data URI
 */
export function svgToDataUri(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Returns full CSS cursor value for a cursor type given an accent color
 * Example: `url("data:image/svg+xml...") 2 2, default`
 */
export function getThemeCursorCssValue(
    type: ThemeCursorType,
    themeColor: string = DEFAULT_THEME_CURSOR_COLOR
): string {
    const config = CURSOR_CONFIGS[type];
    if (!config) {
        return "default";
    }
    const svgStr = config.svg(themeColor);
    const dataUri = svgToDataUri(svgStr);
    return `url("${dataUri}") ${config.hotspot[0]} ${config.hotspot[1]}, ${config.fallback}`;
}

/**
 * Returns dictionary of all `--hh-cursor-*` CSS custom properties for a theme color
 */
export function getThemeCursorCssVariables(
    themeColor: string = DEFAULT_THEME_CURSOR_COLOR
): Record<string, string> {
    const variables: Record<string, string> = {};
    for (const key of Object.keys(CURSOR_CONFIGS) as ThemeCursorType[]) {
        variables[`--hh-cursor-${key}`] = getThemeCursorCssValue(key, themeColor);
    }
    return variables;
}

/**
 * Applies dynamic cursor CSS variables to the document element or custom root target
 */
export function applyThemeCursors(
    themeColor: string = DEFAULT_THEME_CURSOR_COLOR,
    target?: HTMLElement
): void {
    if (typeof document === "undefined") {
        return;
    }
    const elem = target || document.documentElement;
    const vars = getThemeCursorCssVariables(themeColor);
    for (const [prop, val] of Object.entries(vars)) {
        elem.style.setProperty(prop, val);
    }
}
