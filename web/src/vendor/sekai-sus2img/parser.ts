// Vendored from Uni-PJSK-Viewer-Frontend (GPL-3.0), src/vendor/sekai-sus2img/parser.ts
// https://github.com/watagashi-uni/Uni-PJSK-Viewer-Frontend — used under AGPL-3.0 (GPL-3.0 compatible).
// @ts-nocheck
import { Fraction } from './fraction'
import {
    Directional,
    Event,
    Meta,
    Score,
    Slide,
    Tap,
} from './model'

type SpeedDefinitionItem = {
    bar: number
    tick: number
    speed: number
}

type VolumeDefinitionItem = {
    bar: number
    tick: number
    volume: number
}

type ParsedItem =
    | { kind: 'meta'; value: Meta }
    | { kind: 'ticksPerBeat'; value: number }
    | { kind: 'speedControl'; value: number | null }
    | { kind: 'speedDefinition'; id: number; items: SpeedDefinitionItem[] }
    | { kind: 'volumeDefinition'; items: VolumeDefinitionItem[] }
    | { kind: 'event'; value: Event }
    | { kind: 'bpmDefinition'; id: number; bpm: Fraction }
    | { kind: 'bpmReference'; bar: Fraction; id: number }
    | { kind: 'note'; value: Tap | Directional | Slide }

type ParsedLine = {
    type: 'meta' | 'score' | 'comment'
    header: string
    data: string
}

const metaKeys = new Set<string>([
    'title',
    'subtitle',
    'artist',
    'genre',
    'designer',
    'difficulty',
    'playlevel',
    'songid',
    'wave',
    'waveoffset',
    'jacket',
    'background',
    'movie',
    'movieoffset',
    'basebpm',
])

const parseLine = (line: string): ParsedLine => {
    const trimmed = line.trim()

    let match = trimmed.match(/^#(\w+)\s+(.*)$/)
    if (match) {
        return {
            type: 'meta',
            header: match[1],
            data: match[2],
        }
    }

    match = trimmed.match(/^#(\w+):\s*(.*)$/)
    if (match) {
        return {
            type: 'score',
            header: match[1],
            data: match[2],
        }
    }

    return {
        type: 'comment',
        header: 'comment',
        data: trimmed,
    }
}

const maybeUnquote = (value: string): string => {
    const trimmed = value.trim()
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1)
    }
    return trimmed
}

const parseMetaValue = (value: string): string | number => {
    const trimmed = value.trim()
    if (!trimmed.length) {
        return ''
    }

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1)
    }

    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        return Number(trimmed)
    }

    return trimmed
}

const sanitizeSpeedRatio = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) {
        return 1
    }
    return value
}

const visibleSpeedRatio = (value: number): number | null => {
    const speedRatio = sanitizeSpeedRatio(value)
    return Math.abs(speedRatio - 1) > 0.0001 ? speedRatio : null
}

const parseScoreData = (data: string): Array<{ beat: Fraction; pair: string; speedRatio: number }> => {
    const cleaned = data.trim()
    const result: Array<{ beat: Fraction; pair: string; speedRatio: number }> = []

    if (cleaned.includes(',')) {
        const cells: Array<{ pair: string; speedRatio: number }> = []
        let i = 0

        while (i < cleaned.length) {
            while (i < cleaned.length && /\s/u.test(cleaned[i])) {
                i += 1
            }

            if (i + 1 >= cleaned.length) {
                break
            }

            const pair = cleaned.slice(i, i + 2)
            i += 2

            let speedRatio = 1
            if (i < cleaned.length && cleaned[i] === ',') {
                i += 1
                const speedStart = i
                while (i < cleaned.length && !/\s/u.test(cleaned[i]) && cleaned[i] !== ',') {
                    i += 1
                }

                if (i > speedStart) {
                    speedRatio = Number(cleaned.slice(speedStart, i))
                }
            }

            cells.push({ pair, speedRatio: sanitizeSpeedRatio(speedRatio) })

            while (i < cleaned.length && (/\s/u.test(cleaned[i]) || cleaned[i] === ',')) {
                i += 1
            }
        }

        for (let i = 0; i < cells.length; i += 1) {
            const cell = cells[i]
            if (cell.pair !== '00') {
                result.push({
                    beat: new Fraction(i, cells.length),
                    pair: cell.pair,
                    speedRatio: cell.speedRatio,
                })
            }
        }

        return result
    }

    for (let i = 0; i + 1 < cleaned.length; i += 2) {
        const pair = cleaned.slice(i, i + 2)
        if (pair !== '00') {
            result.push({
                beat: new Fraction(i, cleaned.length),
                pair,
                speedRatio: 1,
            })
        }
    }

    return result
}

const parseTimedValueDefinitions = (data: string): Array<{ bar: number; tick: number; value: number }> => {
    const text = maybeUnquote(data)
    const list: Array<{ bar: number; tick: number; value: number }> = []

    if (!text.length) {
        return list
    }

    for (const rawSegment of text.split(',')) {
        const segment = rawSegment.trim()
        if (!segment.length) {
            continue
        }

        const match = segment.match(/(\d+)'(\d+):(\S+)/)
        if (!match) {
            continue
        }

        const value = Number(match[3])
        if (!Number.isFinite(value)) {
            continue
        }

        list.push({
            bar: Number(match[1]),
            tick: Number(match[2]),
            value,
        })
    }

    list.sort((a, b) => (a.bar === b.bar ? a.tick - b.tick : a.bar - b.bar))
    return list
}

const parseMetaItems = (header: string, data: string): ParsedItem[] => {
    const items: ParsedItem[] = []

    const meta = new Meta()
    const key = header.toLowerCase()
    if (metaKeys.has(key)) {
        ;(meta as unknown as Record<string, unknown>)[key] = parseMetaValue(data)
        items.push({ kind: 'meta', value: meta })
        return items
    }

    if (header === 'REQUEST') {
        const match = data.match(/^"ticks_per_beat\s+(\d+)"$/)
        if (match) {
            items.push({
                kind: 'ticksPerBeat',
                value: Number(match[1]),
            })
        }
        return items
    }

    if (header === 'HISPEED') {
        const id = Number.parseInt(data, 36)
        if (Number.isFinite(id)) {
            items.push({ kind: 'speedControl', value: id })
        }
        return items
    }

    if (header === 'NOSPEED') {
        items.push({ kind: 'speedControl', value: null })
    }

    return items
}

const parseScoreItems = (header: string, data: string): ParsedItem[] => {
    const items: ParsedItem[] = []

    let match = header.match(/^(\d\d\d)02$/)
    if (match) {
        items.push({
            kind: 'event',
            value: new Event({
                bar: Number(match[1]),
                barLength: Number(data.trim()),
            }),
        })
        return items
    }

    match = header.match(/^BPM(..)$/)
    if (match) {
        items.push({
            kind: 'bpmDefinition',
            id: Number.parseInt(match[1], 36),
            bpm: new Fraction(data.trim()),
        })
        return items
    }

    match = header.match(/^(\d\d\d)08$/)
    if (match) {
        const bar = Number(match[1])
        for (const { beat, pair } of parseScoreData(data)) {
            items.push({
                kind: 'bpmReference',
                bar: new Fraction(bar).add(beat),
                id: Number.parseInt(pair, 36),
            })
        }
        return items
    }

    match = header.match(/^TIL(..)$/)
    if (match) {
        const id = Number.parseInt(match[1], 36)
        const list = parseTimedValueDefinitions(data).map((item) => ({
            bar: item.bar,
            tick: item.tick,
            speed: item.value,
        }))

        items.push({
            kind: 'speedDefinition',
            id,
            items: list,
        })
        return items
    }

    if (header.startsWith('VOLUME')) {
        items.push({
            kind: 'volumeDefinition',
            items: parseTimedValueDefinitions(data).map((item) => ({
                bar: item.bar,
                tick: item.tick,
                volume: item.value,
            })),
        })
        return items
    }

    match = header.match(/^(\d\d\d)1(.)$/)
    if (match) {
        const bar = Number(match[1])
        const lane = Number.parseInt(match[2], 36)
        for (const { beat, pair, speedRatio } of parseScoreData(data)) {
            items.push({
                kind: 'note',
                value: new Tap({
                    bar: new Fraction(bar).add(beat),
                    lane,
                    width: Number.parseInt(pair[1], 36),
                    type: Number.parseInt(pair[0], 36),
                    speed: visibleSpeedRatio(speedRatio),
                }),
            })
        }
        return items
    }

    match = header.match(/^(\d\d\d)3(.)(.)$/)
    if (match) {
        const bar = Number(match[1])
        const lane = Number.parseInt(match[2], 36)
        const channel = Number.parseInt(match[3], 36)
        for (const { beat, pair, speedRatio } of parseScoreData(data)) {
            items.push({
                kind: 'note',
                value: new Slide({
                    bar: new Fraction(bar).add(beat),
                    lane,
                    width: Number.parseInt(pair[1], 36),
                    type: Number.parseInt(pair[0], 36),
                    speed: visibleSpeedRatio(speedRatio),
                    channel,
                    decoration: false,
                }),
            })
        }
        return items
    }

    match = header.match(/^(\d\d\d)5(.)$/)
    if (match) {
        const bar = Number(match[1])
        const lane = Number.parseInt(match[2], 36)
        for (const { beat, pair, speedRatio } of parseScoreData(data)) {
            items.push({
                kind: 'note',
                value: new Directional({
                    bar: new Fraction(bar).add(beat),
                    lane,
                    width: Number.parseInt(pair[1], 36),
                    type: Number.parseInt(pair[0], 36),
                    speed: visibleSpeedRatio(speedRatio),
                }),
            })
        }
        return items
    }

    match = header.match(/^(\d\d\d)9(.)(.)$/)
    if (match) {
        const bar = Number(match[1])
        const lane = Number.parseInt(match[2], 36)
        const channel = Number.parseInt(match[3], 36)
        for (const { beat, pair, speedRatio } of parseScoreData(data)) {
            items.push({
                kind: 'note',
                value: new Slide({
                    bar: new Fraction(bar).add(beat),
                    lane,
                    width: Number.parseInt(pair[1], 36),
                    type: Number.parseInt(pair[0], 36),
                    speed: visibleSpeedRatio(speedRatio),
                    channel,
                    decoration: true,
                }),
            })
        }
        return items
    }

    return items
}

export const parseSusText = (content: string): Score => {
    const score = new Score()

    const bpmDefinitions = new Map<number, Fraction>()
    let speedControl: number | null = null

    const lines = content.split(/\r?\n/u).map(parseLine)

    for (const line of lines) {
        const parsedItems =
            line.type === 'meta'
                ? parseMetaItems(line.header, line.data)
                : line.type === 'score'
                  ? parseScoreItems(line.header, line.data)
                  : []

        for (const parsedItem of parsedItems) {
            switch (parsedItem.kind) {
                case 'meta':
                    score.meta = score.meta.merge(parsedItem.value)
                    break

                case 'ticksPerBeat':
                    score.ticksPerBeat = parsedItem.value
                    break

                case 'speedControl':
                    speedControl = parsedItem.value
                    break

                case 'speedDefinition':
                    if (speedControl === null || speedControl === parsedItem.id) {
                        for (const item of parsedItem.items) {
                            const bar = new Fraction(item.bar).add(
                                new Fraction(item.tick, score.ticksPerBeat * 4),
                            )
                            score.events.push(
                                new Event({
                                    bar,
                                    speed: item.speed,
                                }),
                            )
                        }
                    }
                    break

                case 'volumeDefinition':
                    for (const item of parsedItem.items) {
                        const bar = new Fraction(item.bar).add(
                            new Fraction(item.tick, score.ticksPerBeat * 4),
                        )
                        score.events.push(
                            new Event({
                                bar,
                                seVolume: item.volume,
                            }),
                        )
                    }
                    break

                case 'event':
                    score.events.push(parsedItem.value)
                    break

                case 'bpmDefinition':
                    bpmDefinitions.set(parsedItem.id, parsedItem.bpm)
                    break

                case 'bpmReference': {
                    const bpm = bpmDefinitions.get(parsedItem.id)
                    if (bpm) {
                        score.events.push(
                            new Event({
                                bar: parsedItem.bar,
                                bpm,
                            }),
                        )
                    }
                    break
                }

                case 'note':
                    score.notes.push(parsedItem.value)
                    break
            }
        }
    }

    score.initNotes()
    score.initEvents()

    return score
}
