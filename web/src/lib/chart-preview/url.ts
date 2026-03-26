export function extractSusWaveOffsetMs(susText: string) {
  const match = susText.match(/^#WAVEOFFSET\s+([+-]?\d+(?:\.\d+)?)/im)
  if (!match) {
    return 0
  }

  const seconds = Number.parseFloat(match[1])
  return Number.isFinite(seconds) ? seconds * 1000 : 0
}

export function normalizeOffsetMs(rawOffsetMs: number | null, susText: string) {
  if (rawOffsetMs !== null) {
    return -rawOffsetMs
  }

  return extractSusWaveOffsetMs(susText)
}
