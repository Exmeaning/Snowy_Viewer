export interface UserArea {
  areaId: number
  actionSets: Array<{
    id: number
    status: string
  }>
  areaItems: Array<{
    areaItemId: number
    level: number
  }>
  userAreaStatus: {
    areaId: number
    status: string
  }
}
