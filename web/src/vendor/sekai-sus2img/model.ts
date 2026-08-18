// Vendored from Uni-PJSK-Viewer-Frontend (GPL-3.0), src/vendor/sekai-sus2img/model.ts
// https://github.com/watagashi-uni/Uni-PJSK-Viewer-Frontend — used under AGPL-3.0 (GPL-3.0 compatible).
// @ts-nocheck
import { Fraction } from './fraction'

const prefer = <T>(current: T | null | undefined, incoming: T | null | undefined): T | null | undefined =>
    current ? current : incoming ?? current

const fractionOrNull = (value: Fraction | number | string | null | undefined): Fraction | null => {
    if (value === undefined || value === null) {
        return null
    }
    return value instanceof Fraction ? value : new Fraction(value)
}

const fractionToNumber = (value: Fraction | null | undefined, fallback: number): number =>
    value ? value.toNumber() : fallback

export class Meta {
    title: string | null = null
    subtitle: string | null = null
    artist: string | null = null
    genre: string | null = null
    designer: string | null = null
    difficulty: string | null = null
    playlevel: string | null = null
    songid: string | null = null
    wave: string | null = null
    waveoffset: string | null = null
    jacket: string | null = null
    background: string | null = null
    movie: string | null = null
    movieoffset: number | null = null
    basebpm: number | null = null

    constructor(values?: Partial<Meta>) {
        if (values) {
            Object.assign(this, values)
        }
    }

    merge(other: Meta): Meta {
        return new Meta({
            title: prefer(this.title, other.title) ?? null,
            subtitle: prefer(this.subtitle, other.subtitle) ?? null,
            artist: prefer(this.artist, other.artist) ?? null,
            genre: prefer(this.genre, other.genre) ?? null,
            designer: prefer(this.designer, other.designer) ?? null,
            difficulty: prefer(this.difficulty, other.difficulty) ?? null,
            playlevel: prefer(this.playlevel, other.playlevel) ?? null,
            songid: prefer(this.songid, other.songid) ?? null,
            wave: prefer(this.wave, other.wave) ?? null,
            waveoffset: prefer(this.waveoffset, other.waveoffset) ?? null,
            jacket: prefer(this.jacket, other.jacket) ?? null,
            background: prefer(this.background, other.background) ?? null,
            movie: prefer(this.movie, other.movie) ?? null,
            movieoffset: prefer(this.movieoffset, other.movieoffset) ?? null,
            basebpm: prefer(this.basebpm, other.basebpm) ?? null,
        })
    }
}

export class Event {
    bar: Fraction
    bpm: Fraction | null
    barLength: Fraction | null
    sentenceLength: number | null
    speed: number | null
    seVolume: number | null
    section: string | null
    text: string | null

    constructor(values: {
        bar: Fraction | number | string
        bpm?: Fraction | number | string | null
        barLength?: Fraction | number | string | null
        sentenceLength?: number | null
        speed?: number | null
        seVolume?: number | null
        section?: string | null
        text?: string | null
    }) {
        this.bar = values.bar instanceof Fraction ? values.bar : new Fraction(values.bar)
        this.bpm = fractionOrNull(values.bpm)
        this.barLength = fractionOrNull(values.barLength)
        this.sentenceLength = values.sentenceLength ?? null
        this.speed = values.speed ?? null
        this.seVolume = values.seVolume ?? null
        this.section = values.section ?? null
        this.text = values.text ?? null
    }

    merge(other: Event): Event {
        return new Event({
            bar: other.bar,
            bpm: (other.bpm ?? this.bpm) ?? null,
            barLength: (other.barLength ?? this.barLength) ?? null,
            sentenceLength: (other.sentenceLength ?? this.sentenceLength) ?? null,
            speed: (other.speed ?? this.speed) ?? null,
            seVolume: (other.seVolume ?? this.seVolume) ?? null,
            section: (other.section ?? this.section) ?? null,
            text: (other.text ?? this.text) ?? null,
        })
    }

    clone(): Event {
        return new Event({
            bar: this.bar,
            bpm: this.bpm,
            barLength: this.barLength,
            sentenceLength: this.sentenceLength,
            speed: this.speed,
            seVolume: this.seVolume,
            section: this.section,
            text: this.text,
        })
    }
}

export abstract class Note {
    bar: Fraction
    lane: number
    width: number
    type: number
    speed: number | null

    protected constructor(values: {
        bar: Fraction | number | string
        lane: number
        width: number
        type: number
        speed?: number | null
    }) {
        this.bar = values.bar instanceof Fraction ? values.bar : new Fraction(values.bar)
        this.lane = values.lane
        this.width = values.width
        this.type = values.type
        this.speed = values.speed ?? null
    }

    isCritical(): boolean {
        return false
    }

    isTrend(): boolean {
        return false
    }

    isNone(): boolean {
        return false
    }

    isTick(): boolean | null {
        return true
    }

    abstract cloneWithBar(bar: Fraction): Note
}

export const TapType = {
    TAP: 1,
    CRITICAL: 2,
    FLICK: 3,
    DAMAGE: 4,
    TREND: 5,
    CRITICAL_TREND: 6,
    CANCEL: 7,
    CRITICAL_CANCEL: 8,
} as const

export class Tap extends Note {
    isCritical(): boolean {
        return (
            this.type === TapType.CRITICAL ||
            this.type === TapType.CRITICAL_TREND ||
            this.type === TapType.CRITICAL_CANCEL
        )
    }

    isTrend(): boolean {
        return this.type === TapType.TREND || this.type === TapType.CRITICAL_TREND
    }

    isNone(): boolean {
        return this.type === TapType.CANCEL || this.type === TapType.CRITICAL_CANCEL
    }

    isTick(): boolean | null {
        if (this.isNone()) {
            return null
        }
        if (this.isTrend()) {
            return false
        }
        return true
    }

    cloneWithBar(bar: Fraction): Tap {
        return new Tap({
            bar,
            lane: this.lane,
            width: this.width,
            type: this.type,
            speed: this.speed,
        })
    }
}

export const DirectionalType = {
    UP: 1,
    DOWN: 2,
    UPPER_LEFT: 3,
    UPPER_RIGHT: 4,
    LOWER_LEFT: 5,
    LOWER_RIGHT: 6,
} as const

export class Directional extends Note {
    tap: Tap | null

    constructor(values: {
        bar: Fraction | number | string
        lane: number
        width: number
        type: number
        speed?: number | null
        tap?: Tap | null
    }) {
        super(values)
        this.tap = values.tap ?? null
    }

    isCritical(): boolean {
        return this.tap ? this.tap.isCritical() : false
    }

    isTrend(): boolean {
        return this.tap ? this.tap.isTrend() : false
    }

    isTick(): boolean | null {
        if (this.isNone()) {
            return null
        }
        if (this.isTrend()) {
            return false
        }
        return true
    }

    cloneWithBar(bar: Fraction): Directional {
        return new Directional({
            bar,
            lane: this.lane,
            width: this.width,
            type: this.type,
            speed: this.speed,
            tap: null,
        })
    }
}

export const SlideType = {
    START: 1,
    END: 2,
    RELAY: 3,
    INVISIBLE: 5,
} as const

export class Slide extends Note {
    channel: number
    decoration: boolean
    tap: Tap | null
    directional: Directional | null
    next: Slide | null
    head: Slide | null

    constructor(values: {
        bar: Fraction | number | string
        lane: number
        width: number
        type: number
        speed?: number | null
        channel?: number
        decoration?: boolean
        tap?: Tap | null
        directional?: Directional | null
        next?: Slide | null
        head?: Slide | null
    }) {
        super(values)
        this.channel = values.channel ?? 0
        this.decoration = values.decoration ?? false
        this.tap = values.tap ?? null
        this.directional = values.directional ?? null
        this.next = values.next ?? null
        this.head = values.head ?? null
    }

    isPath(): boolean {
        if (this.type === 0) {
            return false
        }

        if (this.type !== SlideType.RELAY) {
            return true
        }

        if (this.directional) {
            return true
        }

        if (this.tap === null && this.directional === null) {
            return true
        }

        return false
    }

    isCritical(): boolean {
        if (this.tap && this.tap.isCritical()) {
            return true
        }
        if (this.directional && this.directional.isCritical()) {
            return true
        }
        if (this.head && this.head !== this && this.head.isCritical()) {
            return true
        }
        return false
    }

    isTrend(): boolean {
        if (this.tap && this.tap.isTrend()) {
            return true
        }
        if (this.directional && this.directional.isTrend()) {
            return true
        }
        return false
    }

    isNone(): boolean {
        if (this.tap && this.tap.isNone()) {
            return true
        }
        if (this.directional && this.directional.isNone()) {
            return true
        }
        return false
    }

    isTick(): boolean | null {
        if (this.isNone()) {
            return null
        }

        if (this.decoration) {
            const tapTick = this.tap ? this.tap.isTick() : null
            if (tapTick) {
                return tapTick
            }

            const directionalTick = this.directional ? this.directional.isTick() : null
            if (directionalTick) {
                return directionalTick
            }

            if (tapTick !== null || directionalTick !== null) {
                return false
            }

            return null
        }

        if (this.type === SlideType.INVISIBLE) {
            return null
        }
        if (this.isTrend()) {
            return false
        }
        if (this.type === SlideType.RELAY) {
            return false
        }

        return true
    }

    cloneWithBar(bar: Fraction): Slide {
        return new Slide({
            bar,
            lane: this.lane,
            width: this.width,
            type: this.type,
            speed: this.speed,
            channel: this.channel,
            decoration: this.decoration,
            tap: null,
            directional: null,
            next: null,
            head: null,
        })
    }
}

export type AnyNote = Tap | Directional | Slide

export class Score {
    meta = new Meta()
    notes: AnyNote[] = []
    events: Event[] = []
    ticksPerBeat = 480

    private timedEventsCache: Array<[number, Event]> | null = null

    invalidateCache() {
        this.timedEventsCache = null
    }

    sortNotes() {
        this.notes.sort((a, b) => {
            const cmp = a.bar.compare(b.bar)
            if (cmp !== 0) {
                return cmp
            }
            return a.lane - b.lane
        })
    }

    initNotes() {
        this.sortNotes()

        const noteDeleted = new Array<boolean>(this.notes.length).fill(false)
        const noteIndexes = new Map<string, number[]>()

        for (let i = 0; i < this.notes.length; i += 1) {
            const note = this.notes[i]
            if (!(0 <= note.lane - 2 && note.lane - 2 < 12)) {
                noteDeleted[i] = true
                this.events.push(
                    new Event({
                        bar: note.bar,
                        text:
                            note.lane === 0
                                ? 'SKILL'
                                : note.type === 1
                                  ? 'FEVER CHANCE!'
                                  : 'SUPER FEVER!!',
                    }),
                )
                continue
            }

            const key = note.bar.key()
            const indexes = noteIndexes.get(key)
            if (indexes) {
                indexes.push(i)
            } else {
                noteIndexes.set(key, [i])
            }
        }

        for (let i = 0; i < this.notes.length; i += 1) {
            const directional = this.notes[i]
            if (noteDeleted[i] || !(directional instanceof Directional)) {
                continue
            }

            const indexes = noteIndexes.get(directional.bar.key())
            if (!indexes) {
                continue
            }

            for (const j of indexes) {
                const tap = this.notes[j]
                if (noteDeleted[j] || !(tap instanceof Tap)) {
                    continue
                }

                if (
                    tap.bar.equals(directional.bar) &&
                    tap.lane === directional.lane &&
                    tap.width === directional.width
                ) {
                    noteDeleted[j] = true
                    directional.tap = tap
                }
            }
        }

        for (let i = 0; i < this.notes.length; i += 1) {
            const slide = this.notes[i]
            if (noteDeleted[i] || !(slide instanceof Slide)) {
                continue
            }

            if (slide.head === null) {
                slide.head = slide
            }

            const indexes = noteIndexes.get(slide.bar.key())
            if (indexes) {
                for (const j of indexes) {
                    const tap = this.notes[j]
                    if (noteDeleted[j] || !(tap instanceof Tap)) {
                        continue
                    }

                    if (tap.bar.equals(slide.bar) && tap.lane === slide.lane && tap.width === slide.width) {
                        noteDeleted[j] = true
                        slide.tap = tap
                    }
                }

                for (const j of indexes) {
                    const directional = this.notes[j]
                    if (noteDeleted[j] || !(directional instanceof Directional)) {
                        continue
                    }

                    if (
                        directional.bar.equals(slide.bar) &&
                        directional.lane === slide.lane &&
                        directional.width === slide.width
                    ) {
                        noteDeleted[j] = true
                        slide.directional = directional
                        if (directional.tap) {
                            slide.tap = directional.tap
                        }
                    }
                }
            }

            if (slide.type !== SlideType.END) {
                for (let j = i + 1; j < this.notes.length; j += 1) {
                    const next = this.notes[j]
                    if (
                        noteDeleted[j] ||
                        !(next instanceof Slide) ||
                        next.channel !== slide.channel ||
                        next.decoration !== slide.decoration
                    ) {
                        continue
                    }

                    slide.next = next
                    next.head = slide.head
                    break
                }
            }
        }

        this.notes = this.notes.filter((_, idx) => !noteDeleted[idx])
        this.sortNotes()
    }

    initEvents() {
        this.events.sort((a, b) => a.bar.compare(b.bar))

        const merged: Event[] = []
        for (const event of this.events) {
            const last = merged[merged.length - 1]
            if (last && event.bar.equals(last.bar)) {
                merged[merged.length - 1] = last.merge(event)
            } else {
                merged.push(event.clone())
            }
        }

        this.events = merged
        this.invalidateCache()
    }

    private getTimedEvents(): Array<[number, Event]> {
        if (this.timedEventsCache) {
            return this.timedEventsCache
        }

        const timedEvents: Array<[number, Event]> = []

        let t = 0
        let current = new Event({
            bar: 0,
            bpm: 120,
            barLength: 4,
            sentenceLength: 4,
        })

        for (const event of this.events) {
            t +=
                event.bar.sub(current.bar).toNumber() *
                fractionToNumber(current.barLength, 4) *
                60 /
                fractionToNumber(current.bpm, 120)

            current = current.merge(event)
            timedEvents.push([t, current])
        }

        if (!timedEvents.length) {
            timedEvents.push([0, current])
        }

        this.timedEventsCache = timedEvents
        return timedEvents
    }

    getTimedEvent(barInput: Fraction | number): [number, Event] {
        const bar = barInput instanceof Fraction ? barInput : new Fraction(barInput)
        const timedEvents = this.getTimedEvents()

        let index = 0
        let low = 0
        let high = timedEvents.length - 1
        while (low <= high) {
            const mid = Math.floor((low + high) / 2)
            const cmp = timedEvents[mid][1].bar.compare(bar)
            if (cmp <= 0) {
                index = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }

        const [baseTime, event] = timedEvents[index]
        const delta = fractionToNumber(event.barLength, 4) * 60 / fractionToNumber(event.bpm, 120)
        const time = baseTime + delta * bar.sub(event.bar).toNumber()
        return [time, event]
    }

    getTime(bar: Fraction | number): number {
        return this.getTimedEvent(bar)[0]
    }

    getEvent(bar: Fraction | number): Event {
        return this.getTimedEvent(bar)[1]
    }

    getTimeDelta(barFrom: Fraction | number, barTo: Fraction | number): number {
        return this.getTime(barTo) - this.getTime(barFrom)
    }

    getBarByTime(time: number): Fraction {
        let t = 0
        let event = new Event({
            bar: 0,
            bpm: 120,
            barLength: 4,
            sentenceLength: 4,
        })

        for (let i = 0; i < this.events.length; i += 1) {
            event = event.merge(this.events[i])
            if (i + 1 === this.events.length) {
                break
            }

            const next = this.events[i + 1]
            const eventTime =
                fractionToNumber(event.barLength, 4) *
                60 /
                fractionToNumber(event.bpm, 120) *
                next.bar.sub(event.bar).toNumber()

            if (t + eventTime > time) {
                break
            }

            t += eventTime
        }

        const bar =
            event.bar.toNumber() +
            (time - t) / (fractionToNumber(event.barLength, 4) * 60 / fractionToNumber(event.bpm, 120))

        return new Fraction(bar).limitDenominator(1_000_000)
    }
}
