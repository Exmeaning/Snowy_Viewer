// Vendored from Uni-PJSK-Viewer-Frontend (GPL-3.0), src/vendor/sekai-sus2img/fraction.ts
// https://github.com/watagashi-uni/Uni-PJSK-Viewer-Frontend — used under AGPL-3.0 (GPL-3.0 compatible).
// @ts-nocheck
export type FractionInput = Fraction | number | string | bigint

const FRACTION_RE = /^([+-]?\d+)\/(\d+)$/
const DECIMAL_RE = /^([+-]?\d+)(?:\.(\d+))?$/

const bigintAbs = (value: bigint): bigint => (value < 0n ? -value : value)

const gcd = (a: bigint, b: bigint): bigint => {
    let x = bigintAbs(a)
    let y = bigintAbs(b)
    while (y !== 0n) {
        const t = x % y
        x = y
        y = t
    }
    return x || 1n
}

const normalize = (numerator: bigint, denominator: bigint): [bigint, bigint] => {
    if (denominator === 0n) {
        throw new Error('Denominator cannot be zero')
    }

    if (denominator < 0n) {
        numerator = -numerator
        denominator = -denominator
    }

    const g = gcd(numerator, denominator)
    return [numerator / g, denominator / g]
}

const parseDecimalString = (value: string): [bigint, bigint] => {
    const trimmed = value.trim()
    if (!trimmed.length) {
        throw new Error('Empty number string')
    }

    const fractionMatch = trimmed.match(FRACTION_RE)
    if (fractionMatch) {
        const numerator = BigInt(fractionMatch[1])
        const denominator = BigInt(fractionMatch[2])
        return normalize(numerator, denominator)
    }

    const decimalMatch = trimmed.match(DECIMAL_RE)
    if (decimalMatch) {
        const integerPart = decimalMatch[1]
        const decimalPart = decimalMatch[2] ?? ''
        const scale = 10n ** BigInt(decimalPart.length)
        const whole = BigInt(integerPart)
        const sign = whole < 0n || integerPart.startsWith('-') ? -1n : 1n
        const absWhole = bigintAbs(whole)
        const absNumber = BigInt(`${absWhole}${decimalPart}`)
        return normalize(sign * absNumber, scale)
    }

    // fallback for scientific notation from Number.toString(), e.g. 1e-7
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number: ${value}`)
    }

    return fromNumber(parsed)
}

const fromNumber = (value: number, maxDenominator = 1_000_000n): [bigint, bigint] => {
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid number: ${value}`)
    }

    const sign = value < 0 ? -1n : 1n
    const abs = Math.abs(value)
    const whole = Math.floor(abs)
    const fractional = abs - whole

    if (fractional === 0) {
        return [sign * BigInt(whole), 1n]
    }

    // Continued fraction approximation.
    let h1 = 1n
    let h0 = 0n
    let k1 = 0n
    let k0 = 1n

    let b = fractional
    let a = Math.floor(b)

    for (let i = 0; i < 64; i += 1) {
        const h2 = BigInt(a) * h1 + h0
        const k2 = BigInt(a) * k1 + k0

        if (k2 > maxDenominator) {
            break
        }

        h0 = h1
        h1 = h2
        k0 = k1
        k1 = k2

        const fracPart = b - a
        if (Math.abs(fracPart) < 1e-12) {
            break
        }

        b = 1 / fracPart
        a = Math.floor(b)
    }

    const numerator = sign * (BigInt(whole) * k1 + h1)
    const denominator = k1
    return normalize(numerator, denominator)
}

export class Fraction {
    readonly numerator: bigint
    readonly denominator: bigint

    constructor(value: FractionInput = 0, denominator?: FractionInput) {
        if (denominator !== undefined) {
            const left = Fraction.from(value)
            const right = Fraction.from(denominator)
            const [n, d] = normalize(
                left.numerator * right.denominator,
                left.denominator * right.numerator,
            )
            this.numerator = n
            this.denominator = d
            return
        }

        if (value instanceof Fraction) {
            this.numerator = value.numerator
            this.denominator = value.denominator
            return
        }

        if (typeof value === 'bigint') {
            this.numerator = value
            this.denominator = 1n
            return
        }

        if (typeof value === 'number') {
            const [n, d] = fromNumber(value)
            this.numerator = n
            this.denominator = d
            return
        }

        const [n, d] = parseDecimalString(value)
        this.numerator = n
        this.denominator = d
    }

    static from(value: FractionInput): Fraction {
        return value instanceof Fraction ? value : new Fraction(value)
    }

    static zero(): Fraction {
        return new Fraction(0)
    }

    static one(): Fraction {
        return new Fraction(1)
    }

    add(value: FractionInput): Fraction {
        const other = Fraction.from(value)
        return new Fraction(
            this.numerator * other.denominator + other.numerator * this.denominator,
            this.denominator * other.denominator,
        )
    }

    sub(value: FractionInput): Fraction {
        const other = Fraction.from(value)
        return new Fraction(
            this.numerator * other.denominator - other.numerator * this.denominator,
            this.denominator * other.denominator,
        )
    }

    mul(value: FractionInput): Fraction {
        const other = Fraction.from(value)
        return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator)
    }

    div(value: FractionInput): Fraction {
        const other = Fraction.from(value)
        return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator)
    }

    neg(): Fraction {
        return new Fraction(-this.numerator, this.denominator)
    }

    abs(): Fraction {
        return new Fraction(bigintAbs(this.numerator), this.denominator)
    }

    floor(): bigint {
        if (this.numerator >= 0n) {
            return this.numerator / this.denominator
        }
        return -((-this.numerator + this.denominator - 1n) / this.denominator)
    }

    ceil(): bigint {
        if (this.numerator >= 0n) {
            return (this.numerator + this.denominator - 1n) / this.denominator
        }
        return -((-this.numerator) / this.denominator)
    }

    limitDenominator(maxDenominator: number): Fraction {
        if (maxDenominator <= 0) {
            return new Fraction(this)
        }
        return new Fraction(this.toNumber())
    }

    compare(value: FractionInput): number {
        const other = Fraction.from(value)
        const left = this.numerator * other.denominator
        const right = other.numerator * this.denominator
        if (left < right) return -1
        if (left > right) return 1
        return 0
    }

    equals(value: FractionInput): boolean {
        return this.compare(value) === 0
    }

    toNumber(): number {
        return Number(this.numerator) / Number(this.denominator)
    }

    isInteger(): boolean {
        return this.denominator === 1n
    }

    key(): string {
        return `${this.numerator}/${this.denominator}`
    }

    toString(): string {
        if (this.denominator === 1n) {
            return this.numerator.toString()
        }
        return `${this.numerator}/${this.denominator}`
    }
}
