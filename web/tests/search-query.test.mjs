/**
 * Unit tests for the advanced search query parser (src/lib/searchQuery.ts).
 * Run with: node --test web/tests/search-query.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import { importWebTypeScript } from "./characterization/test-helpers.mjs";

const mod = await importWebTypeScript("src/lib/searchQuery.ts");
const { parseSearchQuery, parseDateValue, matchExpr } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function terms(expr) {
  // flatten expr leaves (for simple single-term assertions)
  if (expr.kind === "term") return [expr.term];
  return [...terms(expr.left), ...terms(expr.right)];
}

function kinds(expr) {
  return terms(expr).map((t) => t.kind);
}

// Fake item + matcher for matchExpr evaluation tests
function makeItem(over = {}) {
  return {
    id: 1,
    prefix: "leo moment",
    title: "Leo/need テーマソング",
    releaseAt: Date.UTC(2024, 2, 15),
    level: 35,
    difficulty: 35.5,
    bpm: 182,
    ...over,
  };
}

const cardMatcher = (term, item) => {
  switch (term.kind) {
    case "id-eq":
      return item.id === term.value;
    case "id-range":
      return item.id >= term.lo && item.id <= term.hi;
    case "date-range":
      return item.releaseAt >= term.loTs && item.releaseAt <= term.hiTs;
    case "text":
      return item.prefix.toLowerCase().includes(term.value.toLowerCase());
    default:
      return false;
  }
};

// ---------------------------------------------------------------------------
// Empty / text / id
// ---------------------------------------------------------------------------

test("empty and operator-only queries return null (no filter)", () => {
  assert.equal(parseSearchQuery(""), null);
  assert.equal(parseSearchQuery("   "), null);
  assert.equal(parseSearchQuery("AND OR"), null);
});

test("bare text token stays text", () => {
  const expr = parseSearchQuery("leo");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "leo" } });
});

test("bare number becomes id-eq (not text)", () => {
  const expr = parseSearchQuery("79");
  assert.deepEqual(expr, { kind: "term", term: { kind: "id-eq", value: 79 } });
});

test("bare numeric range becomes id-range", () => {
  const expr = parseSearchQuery("1-100");
  assert.deepEqual(expr, { kind: "term", term: { kind: "id-range", lo: 1, hi: 100 } });
});

test("non-numeric dash text stays text", () => {
  const expr = parseSearchQuery("carnival-maker");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "carnival-maker" } });
});

test("reversed range falls back to text", () => {
  const expr = parseSearchQuery("100-1");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "100-1" } });
});

// ---------------------------------------------------------------------------
// AND / OR / implicit AND
// ---------------------------------------------------------------------------

test("space is implicit AND", () => {
  const expr = parseSearchQuery("leo vivid");
  assert.equal(expr.kind, "and");
  assert.deepEqual(kinds(expr), ["text", "text"]);
});

test("explicit AND equals implicit AND", () => {
  const expr = parseSearchQuery("leo AND vivid");
  assert.equal(expr.kind, "and");
  assert.equal(expr.left.kind, "term");
  assert.equal(expr.right.kind, "term");
});

test("OR works (case-insensitive operator)", () => {
  const expr = parseSearchQuery("leo or vivid");
  assert.equal(expr.kind, "or");
});

test("AND binds tighter than OR: a OR b AND c = a OR (b AND c)", () => {
  const expr = parseSearchQuery("leo OR vivid AND 1-100");
  assert.equal(expr.kind, "or");
  assert.equal(expr.left.kind, "term");
  assert.equal(expr.right.kind, "and");
  assert.equal(expr.right.right.term.kind, "id-range");
});

test("parentheses override precedence: (a OR b) AND c", () => {
  const expr = parseSearchQuery("(leo OR vivid) AND 1-100");
  assert.equal(expr.kind, "and");
  assert.equal(expr.left.kind, "or");
  assert.equal(expr.left.left.term.kind, "text");
  assert.equal(expr.right.term.kind, "id-range");
});

test("nested parentheses", () => {
  const expr = parseSearchQuery("(leo OR vivid) AND (id:1-50 OR id:200-300)");
  assert.equal(expr.kind, "and");
  assert.equal(expr.left.kind, "or");
  assert.equal(expr.right.kind, "or");
  assert.equal(expr.right.left.term.kind, "id-range");
  assert.equal(expr.right.right.term.kind, "id-range");
});

test("words containing and/or are not operators", () => {
  const expr = parseSearchQuery("dandy");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "dandy" } });
});

test("leading stray operator is tolerated", () => {
  const expr = parseSearchQuery("AND leo");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "leo" } });
});

test("lone parenthesis degrades to text without crashing", () => {
  const expr = parseSearchQuery("( leo");
  assert.equal(expr.kind, "and");
  assert.deepEqual(kinds(expr), ["text", "text"]);
});

// ---------------------------------------------------------------------------
// Quoting / escaping
// ---------------------------------------------------------------------------

test('quoted "505" stays text even though numeric', () => {
  const expr = parseSearchQuery('"505"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "505" } });
});

test('quoted phrase keeps inner spaces as one literal', () => {
  const expr = parseSearchQuery('"star of hope"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "star of hope" } });
});

test('quote escape: "ab\\"c" is the literal ab"c', () => {
  const expr = parseSearchQuery('"ab\\"c"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: 'ab"c' } });
});

test("quoted tokens are not operators", () => {
  const expr = parseSearchQuery('"and"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "and" } });
});

test("unclosed quote degrades to literal text", () => {
  const expr = parseSearchQuery('"abc def');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "abc def" } });
});

test("quoted literal combines with other tokens", () => {
  const expr = parseSearchQuery('"star of hope" AND 1-100');
  assert.equal(expr.kind, "and");
  assert.equal(expr.left.term.kind, "text");
  assert.equal(expr.right.term.kind, "id-range");
});

test('id:"109-113" parses as a field range (quoted value)', () => {
  const expr = parseSearchQuery('id:"109-113"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "id-range", lo: 109, hi: 113 } });
});

test('id:"109 - 113" tolerates spaces around the range dash', () => {
  const expr = parseSearchQuery('"id:109 - 113"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "id-range", lo: 109, hi: 113 } });
});

test('date:"2026.8.19 - 2026.8.23" parses with spaces around the dash', () => {
  const expr = parseSearchQuery('date:"2026.8.19 - 2026.8.23"');
  const t = expr.term;
  assert.equal(t.kind, "date-range");
  assert.equal(t.loTs, Date.UTC(2026, 7, 19));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 23, 23, 59, 59, 999));
});

test('bare "505" quoted stays text even though numeric', () => {
  const expr = parseSearchQuery('"505"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "505" } });
});

test("quoted field values tolerate spaces after commas", () => {
  const expr = parseSearchQuery('id:"1, 4, 9"');
  assert.equal(expr.kind, "or");
  assert.deepEqual(kinds(expr), ["id-eq", "id-eq", "id-eq"]);
});

test('"id:abc" (quoted unknown field value) stays text', () => {
  const expr = parseSearchQuery('"id:abc"');
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "id:abc" } });
});

// ---------------------------------------------------------------------------
// Field tokens
// ---------------------------------------------------------------------------

test("id field: single / enumeration / range", () => {
  assert.deepEqual(parseSearchQuery("id:79").term, { kind: "id-eq", value: 79 });
  const enumExpr = parseSearchQuery("id:1,4,9");
  assert.equal(enumExpr.kind, "or");
  assert.deepEqual(kinds(enumExpr), ["id-eq", "id-eq", "id-eq"]);
  assert.deepEqual(parseSearchQuery("id:1-100").term, { kind: "id-range", lo: 1, hi: 100 });
});

test("id field rejects non-numeric values → text", () => {
  const expr = parseSearchQuery("id:abc");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "id:abc" } });
});

test("date field single month spans whole month", () => {
  const expr = parseSearchQuery("date:2024.1");
  const t = expr.term;
  assert.equal(t.kind, "date-range");
  assert.equal(t.loTs, Date.UTC(2024, 0, 1, 0, 0, 0, 0));
  assert.equal(t.hiTs, Date.UTC(2024, 0, 31, 23, 59, 59, 999));
});

test("date field range bounds are inclusive", () => {
  const expr = parseSearchQuery("date:2026.8.19-2026.8.23");
  const t = expr.term;
  assert.equal(t.loTs, Date.UTC(2026, 7, 19, 0, 0, 0, 0));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 23, 23, 59, 59, 999));
});

test("date field mixed granularity and year crossing", () => {
  const expr = parseSearchQuery("date:2026.12-2027.1");
  const t = expr.term;
  assert.equal(t.loTs, Date.UTC(2026, 11, 1, 0, 0, 0, 0));
  assert.equal(t.hiTs, Date.UTC(2027, 0, 31, 23, 59, 59, 999));
});

test("date field enumeration", () => {
  const expr = parseSearchQuery("date:2024.1,2024.3");
  assert.equal(expr.kind, "or");
  assert.deepEqual(kinds(expr), ["date-range", "date-range"]);
});

test("invalid date values stay text", () => {
  const expr = parseSearchQuery("date:abc");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "date:abc" } });
});

test("dates past year 2999 are rejected", () => {
  const expr = parseSearchQuery("date:3000.1");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "date:3000.1" } });
});

test("yearless date M.D defaults to current year (injectable now)", () => {
  // now = 2026-06-01 → 8.19 means 2026-08-19
  const expr = parseSearchQuery("date:8.19", undefined, Date.UTC(2026, 5, 1));
  const t = expr.term;
  assert.equal(t.kind, "date-range");
  assert.equal(t.loTs, Date.UTC(2026, 7, 19));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 19, 23, 59, 59, 999));
});

test("yearless date M defaults to current year's month", () => {
  const expr = parseSearchQuery("date:8", undefined, Date.UTC(2026, 5, 1));
  const t = expr.term;
  assert.equal(t.loTs, Date.UTC(2026, 7, 1));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 31, 23, 59, 59, 999));
});

test("yearless date range M.D-M.D", () => {
  const expr = parseSearchQuery("date:8.19-8.23", undefined, Date.UTC(2026, 5, 1));
  const t = expr.term;
  assert.equal(t.loTs, Date.UTC(2026, 7, 19));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 23, 23, 59, 59, 999));
});

test("mixed yearless and full date range", () => {
  const expr = parseSearchQuery("date:8.19-2026.8.23", undefined, Date.UTC(2026, 5, 1));
  const t = expr.term;
  assert.equal(t.loTs, Date.UTC(2026, 7, 19));
  assert.equal(t.hiTs, Date.UTC(2026, 7, 23, 23, 59, 59, 999));
});

test("yearless range crossing year boundary is rejected", () => {
  // 12.25 → Dec 25 this year, 1.3 → Jan 3 this year (already passed) → reversed → null
  const expr = parseSearchQuery("date:12.25-1.3", undefined, Date.UTC(2026, 5, 1));
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "date:12.25-1.3" } });
});

test("yearless single day vs full year disambiguation", () => {
  // 2026 = year, 8 = month of current year, 2026.8 = year.month
  assert.equal(parseSearchQuery("date:8", undefined, Date.UTC(2026, 5, 1)).term.kind, "date-range");
  const full = parseSearchQuery("date:2026.8", undefined, Date.UTC(2026, 5, 1));
  assert.equal(full.term.loTs, Date.UTC(2026, 7, 1));
});

test("parseDateValue unit checks", () => {
  const month = parseDateValue("2026.8");
  assert.equal(month.loTs, Date.UTC(2026, 7, 1));
  assert.equal(month.hiTs, Date.UTC(2026, 7, 31, 23, 59, 59, 999));
  const r = parseDateValue("2026.8.19-2026.8.23");
  assert.equal(r.loTs, Date.UTC(2026, 7, 19));
  assert.equal(r.hiTs, Date.UTC(2026, 7, 23, 23, 59, 59, 999));
  assert.equal(parseDateValue("2026.8.19-2026.2"), null); // reversed → null
  assert.equal(parseDateValue("abc"), null);
  assert.equal(parseDateValue("2026.13"), null); // month out of range
  assert.equal(parseDateValue("2026.2.30"), null); // invalid day for Feb
});

// ---------------------------------------------------------------------------
// Extra fields (registry injection)
// ---------------------------------------------------------------------------

const EXTRA = {
  level: (raw) => {
    const m = /^(\d+)-(\d+)$/.exec(raw.trim());
    if (!m) return null;
    return [{ kind: "level-range", lo: Number(m[1]), hi: Number(m[2]) }];
  },
  bpm: (raw) => {
    const m = /^(\d+)-(\d+)$/.exec(raw.trim());
    if (!m) return null;
    return [{ kind: "bpm-range", lo: Number(m[1]), hi: Number(m[2]) }];
  },
};

test("registered extra field parses", () => {
  const expr = parseSearchQuery("level:35-36", EXTRA);
  assert.deepEqual(expr, { kind: "term", term: { kind: "level-range", lo: 35, hi: 36 } });
});

test("unregistered field falls back to text", () => {
  const expr = parseSearchQuery("level:35-36");
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "level:35-36" } });
});

test("extra field with unparseable value falls back to text", () => {
  const expr = parseSearchQuery("bpm:fast", EXTRA);
  assert.deepEqual(expr, { kind: "term", term: { kind: "text", value: "bpm:fast" } });
});

// ---------------------------------------------------------------------------
// matchExpr evaluation
// ---------------------------------------------------------------------------

test("matchExpr evaluates AND/OR/parens correctly", () => {
  const item = makeItem({ id: 50, prefix: "leo moment", releaseAt: Date.UTC(2024, 2, 15) });

  assert.equal(matchExpr(parseSearchQuery("leo"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery("pump"), item, cardMatcher), false);
  assert.equal(matchExpr(parseSearchQuery("79"), item, cardMatcher), false);
  assert.equal(matchExpr(parseSearchQuery("1-100"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery("leo AND 1-100"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery("leo OR 79"), item, cardMatcher), true);
  // Distinguishes AND-binds-tighter: OR-first reading would give (leo OR 79) AND pump = false.
  assert.equal(matchExpr(parseSearchQuery("leo OR 79 AND pump"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery("leo OR vivid AND 1-100"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery("(leo OR vivid) AND 1-100"), item, cardMatcher), true);
  assert.equal(matchExpr(parseSearchQuery('("leo" OR "vivid") AND "moment"'), item, cardMatcher), true);
  assert.equal(
    matchExpr(parseSearchQuery("date:2024.3.1-2024.3.31"), item, cardMatcher),
    true,
  );
  assert.equal(
    matchExpr(parseSearchQuery("date:2024.2"), item, cardMatcher), // February only
    false,
  );
  assert.equal(matchExpr(parseSearchQuery("id:1,4,9"), item, cardMatcher), false);
  assert.equal(matchExpr(parseSearchQuery("id:1,4,50"), item, cardMatcher), true);
});