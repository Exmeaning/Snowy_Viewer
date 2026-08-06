// The root JSON value has depth 1; each object member or array element adds 1.
export const MAX_STRICT_JSON_DEPTH = 64;

const JSON_WHITESPACE = new Set(["\u0009", "\u000a", "\u000d", "\u0020"]);
const HIGH_SURROGATE_START = 0xD800;
const HIGH_SURROGATE_END = 0xDBFF;
const LOW_SURROGATE_START = 0xDC00;
const LOW_SURROGATE_END = 0xDFFF;
const CONTROL_CHARACTER_END = 0x1F;
const DECIMAL_BASE = 10;
const HEXADECIMAL_BASE = 16;

function failStrictJson() {
    throw new SyntaxError("Invalid JSON");
}

function isDigit(character) {
    return character >= "0" && character <= "9";
}

function isNonZeroDigit(character) {
    return character >= "1" && character <= "9";
}

function hexDigitValue(character) {
    if (character >= "0" && character <= "9") return character.charCodeAt(0) - "0".charCodeAt(0);
    if (character >= "a" && character <= "f") return character.charCodeAt(0) - "a".charCodeAt(0) + DECIMAL_BASE;
    if (character >= "A" && character <= "F") return character.charCodeAt(0) - "A".charCodeAt(0) + DECIMAL_BASE;
    return -1;
}

export function parseStrictJson(text) {
    if (typeof text !== "string") failStrictJson();

    let index = 0;

    function skipWhitespace() {
        while (index < text.length && JSON_WHITESPACE.has(text[index])) index += 1;
    }

    function readHexQuad() {
        if (index + 4 > text.length) failStrictJson();
        let value = 0;
        for (let offset = 0; offset < 4; offset += 1) {
            const digit = hexDigitValue(text[index + offset]);
            if (digit < 0) failStrictJson();
            value = value * HEXADECIMAL_BASE + digit;
        }
        index += 4;
        return value;
    }

    function scanString(decode) {
        if (text[index] !== "\"") failStrictJson();
        index += 1;
        let decoded = "";

        while (index < text.length) {
            const character = text[index];
            if (character === "\"") {
                index += 1;
                return decode ? decoded : undefined;
            }
            if (character === "\\") {
                index += 1;
                if (index >= text.length) failStrictJson();
                const escape = text[index];
                index += 1;
                switch (escape) {
                    case "\"":
                    case "\\":
                    case "/":
                        if (decode) decoded += escape;
                        break;
                    case "b":
                        if (decode) decoded += "\b";
                        break;
                    case "f":
                        if (decode) decoded += "\f";
                        break;
                    case "n":
                        if (decode) decoded += "\n";
                        break;
                    case "r":
                        if (decode) decoded += "\r";
                        break;
                    case "t":
                        if (decode) decoded += "\t";
                        break;
                    case "u": {
                        const codeUnit = readHexQuad();
                        if (codeUnit >= HIGH_SURROGATE_START && codeUnit <= HIGH_SURROGATE_END) {
                            if (text[index] !== "\\" || text[index + 1] !== "u") failStrictJson();
                            index += 2;
                            const lowSurrogate = readHexQuad();
                            if (lowSurrogate < LOW_SURROGATE_START || lowSurrogate > LOW_SURROGATE_END) failStrictJson();
                            if (decode) {
                                const codePoint = 0x10000
                                    + (codeUnit - HIGH_SURROGATE_START) * 0x400
                                    + lowSurrogate - LOW_SURROGATE_START;
                                decoded += String.fromCodePoint(codePoint);
                            }
                        } else if (codeUnit >= LOW_SURROGATE_START && codeUnit <= LOW_SURROGATE_END) {
                            failStrictJson();
                        } else if (decode) {
                            decoded += String.fromCharCode(codeUnit);
                        }
                        break;
                    }
                    default:
                        failStrictJson();
                }
                continue;
            }

            const codeUnit = text.charCodeAt(index);
            if (codeUnit <= CONTROL_CHARACTER_END) failStrictJson();
            if (codeUnit >= HIGH_SURROGATE_START && codeUnit <= HIGH_SURROGATE_END) {
                const lowSurrogate = text.charCodeAt(index + 1);
                if (lowSurrogate < LOW_SURROGATE_START || lowSurrogate > LOW_SURROGATE_END) failStrictJson();
                if (decode) decoded += text.slice(index, index + 2);
                index += 2;
                continue;
            }
            if (codeUnit >= LOW_SURROGATE_START && codeUnit <= LOW_SURROGATE_END) failStrictJson();
            if (decode) decoded += character;
            index += 1;
        }
        failStrictJson();
    }

    function scanNumber() {
        if (text[index] === "-") index += 1;
        if (text[index] === "0") {
            index += 1;
        } else {
            if (!isNonZeroDigit(text[index])) failStrictJson();
            while (isDigit(text[index])) index += 1;
        }
        if (text[index] === ".") {
            index += 1;
            if (!isDigit(text[index])) failStrictJson();
            while (isDigit(text[index])) index += 1;
        }
        if (text[index] === "e" || text[index] === "E") {
            index += 1;
            if (text[index] === "+" || text[index] === "-") index += 1;
            if (!isDigit(text[index])) failStrictJson();
            while (isDigit(text[index])) index += 1;
        }
    }

    function scanLiteral(literal) {
        if (text.slice(index, index + literal.length) !== literal) failStrictJson();
        index += literal.length;
    }

    function scanObject(depth) {
        index += 1;
        skipWhitespace();
        if (text[index] === "}") {
            index += 1;
            return;
        }

        const keys = new Set();
        while (true) {
            const key = scanString(true);
            if (keys.has(key)) failStrictJson();
            keys.add(key);
            skipWhitespace();
            if (text[index] !== ":") failStrictJson();
            index += 1;
            scanValue(depth + 1);
            skipWhitespace();
            if (text[index] === "}") {
                index += 1;
                return;
            }
            if (text[index] !== ",") failStrictJson();
            index += 1;
            skipWhitespace();
        }
    }

    function scanArray(depth) {
        index += 1;
        skipWhitespace();
        if (text[index] === "]") {
            index += 1;
            return;
        }

        while (true) {
            scanValue(depth + 1);
            skipWhitespace();
            if (text[index] === "]") {
                index += 1;
                return;
            }
            if (text[index] !== ",") failStrictJson();
            index += 1;
            skipWhitespace();
        }
    }

    function scanValue(depth) {
        if (depth > MAX_STRICT_JSON_DEPTH) failStrictJson();
        skipWhitespace();
        switch (text[index]) {
            case "{":
                scanObject(depth);
                return;
            case "[":
                scanArray(depth);
                return;
            case "\"":
                scanString(false);
                return;
            case "t":
                scanLiteral("true");
                return;
            case "f":
                scanLiteral("false");
                return;
            case "n":
                scanLiteral("null");
                return;
            default:
                scanNumber();
        }
    }

    scanValue(1);
    skipWhitespace();
    if (index !== text.length) failStrictJson();
    return JSON.parse(text);
}
