export interface Honor {
  id: number
  seq: number
  groupId: number
  honorRarity: string
  name: string
  assetbundleName: string
  levels: Array<{
    honorId: number
    level: number
    bonus: number
    description: string
  }>
}
