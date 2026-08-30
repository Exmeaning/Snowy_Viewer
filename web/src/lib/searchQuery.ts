/**
 * Advanced search query parser for list pages (cards / music / future pages).
 *
 * Syntax (modeled after GitHub/Google search, JQL and Lucene conventions):
 *   space                 = implicit AND
 *   AND / OR              = boolean operators (uppercase, AND binds tighter than OR)
 *   ( ... )               = grouping, nestable
 *   field:value           = field filter (registry-driven; id/date built-in)
 *   lo-hi                 = inclusive numeric range (bare ranges = id range)
 *   ,                     = value enumeration inside a field value (id:1,4,9)
 *   "literal"             = quoted literal; \" escapes a literal double quote
 *
 * The parser is FIELD-AGNOSTIC: pages inject extra fields via `extraFields`
 * (e.g. music registers level/difficulty/bpm). Unregistered or unparseable
 * field tokens fall back to plain text matching.
 *
 * Pure functions — no imports, no DOM, no state. Unit-testable in isolation.
 */

// ============================================================================
// Types
// ============================================================================

export type SearchTerm =
    | { kind: "text"; value: string }                 // plain text or quoted literal
    | { kind: "id-range"; lo: number; hi: number }
    | { kind: "id-eq"; value: number }
    | { kind: "date-range"; loTs: number; hiTs: number }
    | { kind: "level-range"; lo: number; hi: number }
    | { kind: "difficulty-range"; lo: number; hi: number } // song constant
    | { kind: "bpm-range"; lo: number; hi: number };

// Boolean expression AST; parentheses are naturally part of the tree.
export type SearchExpr =
    | { kind: "and"; left: SearchExpr; right: SearchExpr }
    | { kind: "or"; left: SearchExpr; right: SearchExpr }
    | { kind: "term"; term: SearchTerm };

/** Parse one field value into terms (enumeration may yield several); null = unparseable → treat token as text. */
export type FieldValueParser = (raw: string) => SearchTerm[] | null;
/** Field name (lowercase) → value parser. */
export type FieldRegistry = Readonly<Record<string, FieldValueParser>>;

// ============================================================================
// Tokenizer
// ============================================================================

interface Token {
    value: string;
    quoted: boolean; // whole token came from a "..." literal
}

function tokenize(query: string): Token[] {
    const tokens: Token[] = [];
    let current = "";
    let quoted = false;
    let inQuote = false;
    let i = 0;
    const n = query.length;

    const flush = () => {
        if (current !== "") {
            tokens.push({ value: current, quoted });
            current = "";
            quoted = false;
        }
    };

    while (i < n) {
        const ch = query[i];

        if (inQuote) {
            if (ch === "\\" && i + 1 < n && query[i + 1] === '"') {
                current += '"';
                i += 2;
                continue;
            }
            if (ch === '"') {
                inQuote = false;
                i += 1;
                continue;
            }
            current += ch;
            i += 1;
            continue;
        }

        if (ch === '"') {
            inQuote = true;
            quoted = true;
            i += 1;
            continue;
        }
        if (ch === "(" || ch === ")") {
            flush();
            tokens.push({ value: ch, quoted: false });
            i += 1;
            continue;
        }
        if (/\s/.test(ch)) {
            flush();
            i += 1;
            continue;
        }
        current += ch;
        i += 1;
    }
    // Unclosed quote: whatever accumulated becomes one literal token (quoted flag kept → treated as literal text).
    flush();
    return tokens;
}

// ============================================================================
// Value parsers
// ============================================================================

function daysInMonth(year: number, month: number): number {
    // month is 1-12; Date month index 0-11, day 0 = last day of previous month (UTC)
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parse a date value: YYYY / YYYY.M / YYYY.M.D, optionally a range "a-b"
 * with mixed granularity between the two bounds. Returns ms inclusive bounds
 * ([loTs, hiTs]); lo = start of first day (00:00:00.000), hi = end of last
 * day (23:59:59.999). Single values span the whole day/month/year.
 *
 * Yearless forms default to the current year (UTC): M (month), M.D (day).
 * Range example: 8.19-8.23 = 19th to 23rd of August this year.
 * Mixed years are allowed (e.g. 8.19-2026.8.23), but yearless ranges that
 * would cross the year boundary (12.25-1.3) are rejected.
 *
 * `now` is injectable for deterministic tests; defaults to Date.now().
 */
export function parseDateValue(token: string, now: number = Date.now()): { loTs: number; hiTs: number } | null {
    // Range separator allows surrounding whitespace: "2026.8.19 - 2026.8.23"
    const parts = token.split(/\s*-\s*/).map((p) => p.trim());
    if (parts.length < 1 || parts.length > 2 || parts.some((p) => p === "")) return null;

    const currentYear = new Date(now).getUTCFullYear();

    const parseBound = (s: string, asEnd: boolean): number | null => {
        const seg = s.split(".");
        if (seg.length < 1 || seg.length > 3) return null;

        const first = Number(seg[0]);
        if (!Number.isInteger(first)) return null;

        // Determine (year, month, day) from segment count and first segment width.
        // 3 segments always = YYYY.M.D; 2 = YYYY.M or M.D; 1 = YYYY or M.
        let year: number;
        let month: number;
        let day: number | null = null; // null → day 1 (or month end for the hi bound)
        if (seg.length === 3) {
            if (!/^\d{4}$/.test(seg[0]) || first < 2000 || first > 2999) return null;
            year = first;
            month = Number(seg[1]);
            day = Number(seg[2]);
        } else if (seg.length === 2) {
            if (/^\d{4}$/.test(seg[0])) {
                if (first < 2000 || first > 2999) return null;
                year = first;
                month = Number(seg[1]); // YYYY.M
            } else {
                year = currentYear;
                month = first; // M.D (yearless)
                day = Number(seg[1]);
            }
        } else {
            if (/^\d{4}$/.test(seg[0])) {
                if (first < 2000 || first > 2999) return null;
                year = first;
                month = asEnd ? 12 : 1;
            } else if (first >= 1 && first <= 12) {
                year = currentYear;
                month = first;
            } else {
                return null;
            }
        }

        if (!Number.isInteger(month) || month < 1 || month > 12) return null;
        const dayValue = day === null ? (asEnd ? daysInMonth(year, month) : 1) : day;
        if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) return null;
        const date = asEnd
            ? new Date(Date.UTC(year, month - 1, dayValue, 23, 59, 59, 999))
            : new Date(Date.UTC(year, month - 1, dayValue, 0, 0, 0, 0));
        // Reject rolled-over dates (e.g. 2026.2.30 silently becomes March 2).
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== dayValue) return null;
        return date.getTime();
    };

    const loTs = parseBound(parts[0], false);
    if (loTs === null) return null;
    const hiTs = parts.length === 1 ? parseBound(parts[0], true) : parseBound(parts[1], true);
    if (hiTs === null || hiTs < loTs) return null;
    return { loTs, hiTs };
}

/** Built-in id field: id:79 | id:1,4,9 | id:1-100 | id:1 - 10, 20 - 30 */
function parseIdField(raw: string): SearchTerm[] | null {
    const terms: SearchTerm[] = [];
    for (const part of raw.split(",")) {
        const s = part.trim();
        if (/^\d+$/.test(s)) {
            terms.push({ kind: "id-eq", value: Number(s) });
            continue;
        }
        const m = /^(\d+)\s*-\s*(\d+)$/.exec(s);
        if (m) {
            const lo = Number(m[1]);
            const hi = Number(m[2]);
            if (lo <= hi) {
                terms.push({ kind: "id-range", lo, hi });
                continue;
            }
        }
        return null;
    }
    return terms.length > 0 ? terms : null;
}

/** Built-in date field: date:2026.8.19-2026.8.23 | date:2024.1,2024.3 | date:8.19-8.23 */
function parseDateField(raw: string, now: number = Date.now()): SearchTerm[] | null {
    const terms: SearchTerm[] = [];
    for (const part of raw.split(",")) {
        const parsed = parseDateValue(part.trim(), now);
        if (!parsed) return null;
        terms.push({ kind: "date-range", loTs: parsed.loTs, hiTs: parsed.hiTs });
    }
    return terms.length > 0 ? terms : null;
}

/** Generic numeric range field helper (level / difficulty / bpm). */
export function makeNumericField(
    kind: "level-range" | "difficulty-range" | "bpm-range",
    options: { decimal: boolean },
): FieldValueParser {
    const singleRe = options.decimal ? /^\d+(\.\d+)?$/ : /^\d+$/;
    const rangeRe = options.decimal
        ? /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/
        : /^(\d+)\s*-\s*(\d+)$/;

    return (raw) => {
        const terms: SearchTerm[] = [];
        for (const part of raw.split(",")) {
            const s = part.trim();
            if (singleRe.test(s)) {
                const v = Number(s);
                terms.push({ kind, lo: v, hi: v }); // single value = equality range
                continue;
            }
            const m = rangeRe.exec(s);
            if (m) {
                const lo = Number(m[1]);
                const hi = Number(m[2]);
                if (lo <= hi) {
                    terms.push({ kind, lo, hi });
                    continue;
                }
            }
            return null;
        }
        return terms.length > 0 ? terms : null;
    };
}

// Date parser bound to a specific "now" (injectable for deterministic tests).
function makeBuiltinFields(now: number): FieldRegistry {
    return {
        id: parseIdField,
        date: (raw) => parseDateField(raw, now),
    };
}

// ============================================================================
// Recursive-descent parser (AND binds tighter than OR; parentheses override)
// ============================================================================

const FIELD_PREFIX_RE = /^([A-Za-z][A-Za-z0-9_]*):(.*)$/;

function isOperator(token: Token): boolean {
    if (token.quoted) return false;
    const v = token.value.toUpperCase();
    return v === "AND" || v === "OR";
}

class QueryParser {
    private tokens: Token[];
    private pos = 0;
    private extraFields: FieldRegistry | undefined;
    private builtinFields: FieldRegistry;

    constructor(query: string, extraFields?: FieldRegistry, now: number = Date.now()) {
        this.tokens = tokenize(query);
        this.extraFields = extraFields;
        this.builtinFields = makeBuiltinFields(now);
    }

    parse(): SearchExpr | null {
        // Tolerate leading stray operators: "AND leo" behaves like "leo".
        while (this.pos < this.tokens.length && isOperator(this.tokens[this.pos])) {
            this.pos += 1;
        }
        return this.parseOr();
    }

    private peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    private parseOr(): SearchExpr | null {
        let left = this.parseAnd();
        while (left !== null) {
            const next = this.peek();
            if (next === undefined || isOperator(next) === false || next.value.toUpperCase() !== "OR") break;
            this.pos += 1;
            const right = this.parseAnd();
            if (right === null) break;
            left = { kind: "or", left, right };
        }
        return left;
    }

    private parseAnd(): SearchExpr | null {
        let left = this.parsePrimary();
        while (left !== null) {
            const next = this.peek();
            if (next === undefined || next.value === ")") break;
            if (isOperator(next)) {
                if (next.value.toUpperCase() === "AND") {
                    this.pos += 1;
                } else {
                    break; // OR is handled at the parseOr level
                }
            }
            // Plain token without operator → implicit AND.
            const right = this.parsePrimary();
            if (right === null) break;
            left = { kind: "and", left, right };
        }
        return left;
    }

    private parsePrimary(): SearchExpr | null {
        const tok = this.peek();
        if (tok === undefined) return null;

        if (tok.value === "(" && !tok.quoted) {
            const save = this.pos;
            this.pos += 1;
            const inner = this.parseOr();
            if (inner !== null && this.peek()?.value === ")" && !this.peek()!.quoted) {
                this.pos += 1;
                return inner;
            }
            // Unterminated / empty group: restore and treat "(" as plain text.
            this.pos = save;
        }

        const termTok = this.peek();
        if (termTok === undefined) return null;

        const terms = this.parseTermValue(termTok);
        this.pos += 1;

        // Enumeration values become an OR chain scoped to the field.
        let expr: SearchExpr = { kind: "term", term: terms[0] };
        for (let i = 1; i < terms.length; i += 1) {
            expr = { kind: "or", left: expr, right: { kind: "term", term: terms[i] } };
        }
        return expr;
    }

    private parseTermValue(tok: Token): SearchTerm[] {
        const s = tok.value;

        // Field prefix takes precedence even when the value is quoted:
        // id:"109-113" / date:"2026.8.19 - 2026.8.23" parse as field terms,
        // while a bare "505" stays a literal text term.
        const fieldMatch = FIELD_PREFIX_RE.exec(s);
        if (fieldMatch) {
            const name = fieldMatch[1].toLowerCase();
            const raw = fieldMatch[2].trim();
            if (raw !== "") {
                const parser = this.builtinFields[name] ?? this.extraFields?.[name];
                if (parser) {
                    const terms = parser(raw);
                    if (terms !== null) return terms;
                }
            }
            // Unregistered / unparseable field → fall through.
        }

        // Quoted literal: no syntax interpretation at all.
        if (tok.quoted) return [{ kind: "text", value: s }];

        // Bare number → id; bare numeric range → id range. Everything else is text.
        if (/^\d+$/.test(s)) return [{ kind: "id-eq", value: Number(s) }];
        const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(s);
        if (rangeMatch) {
            const lo = Number(rangeMatch[1]);
            const hi = Number(rangeMatch[2]);
            if (lo <= hi) return [{ kind: "id-range", lo, hi }];
        }
        return [{ kind: "text", value: s }];
    }
}

/**
 * Parse an advanced search query into a boolean expression tree.
 * Returns null for empty / all-operator queries (meaning "no filter").
 * `now` is injectable for deterministic tests (used by yearless date forms).
 */
export function parseSearchQuery(query: string, extraFields?: FieldRegistry, now?: number): SearchExpr | null {
    const trimmed = query.trim();
    if (trimmed === "") return null;
    return new QueryParser(trimmed, extraFields, now).parse();
}

/**
 * Evaluate an expression tree against an item using the page-provided
 * term matcher (AND = both sides, OR = either side).
 */
export function matchExpr<T>(
    expr: SearchExpr,
    item: T,
    matchTerm: (term: SearchTerm, item: T) => boolean,
): boolean {
    switch (expr.kind) {
        case "and":
            return matchExpr(expr.left, item, matchTerm) && matchExpr(expr.right, item, matchTerm);
        case "or":
            return matchExpr(expr.left, item, matchTerm) || matchExpr(expr.right, item, matchTerm);
        case "term":
            return matchTerm(expr.term, item);
    }
}