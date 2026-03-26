export function safeNumber (num: number | undefined): number {
  if (num === undefined || isNaN(num)) return 0
  return num
}
