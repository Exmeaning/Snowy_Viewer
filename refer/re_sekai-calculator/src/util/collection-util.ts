export function findOrThrow<T> (arr: T[], p: (t: T) => boolean): T {
  const result = arr.find(p)
  if (result === undefined) throw new Error('object not found')
  return result
}

export function getOrThrow<K, V> (map: Map<K, V>, key: K): V {
  const value = map.get(key)
  if (value === undefined) throw new Error('key not found')
  return value
}

export function getOrDefault<K, V> (map: Map<K, V>, key: K, defaultValue: V): V {
  const value = map.get(key)
  if (value === undefined) return defaultValue
  return value
}

export function computeWithDefault<K, V> (map: Map<K, V>, key: K, defaultValue: V, action: (v: V) => V): void {
  map.set(key, action(getOrDefault(map, key, defaultValue)))
}

export function duplicateObj<T> (obj: T, times: number): T[] {
  const ret: T[] = []
  for (let i = 0; i < times; ++i) ret.push(obj)
  return ret
}

export function mapOrUndefined<K, V> (arr: K[] | undefined, fun: (k: K) => V): V[] | undefined {
  if (arr === undefined) return undefined
  return arr.map(fun)
}

export function containsAny<K> (collection: K[], contains: K[]): boolean {
  for (const c of contains) {
    if (collection.includes(c)) return true
  }
  return false
}

export function swap<K> (arr: K[], i: number, j: number): void {
  const t = arr[i]
  arr[i] = arr[j]
  arr[j] = t
}

interface Printable {
  toString: () => string
}

export function mapToString<K extends Printable, V extends Printable> (map: Map<K, V>): string {
  const strings: string[] = []
  for (const key of map.keys()) {
    const value = map.get(key)
    if (value === undefined) throw new Error('Map to string failed.')
    strings.push(`${key.toString()}->${value.toString()}`)
  }
  return strings.join(', ')
}
