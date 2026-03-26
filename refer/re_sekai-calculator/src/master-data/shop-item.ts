import { type CommonResource } from '../common/resource'

export interface ShopItem {
  id: number
  shopId: number
  seq: number
  releaseConditionId: number
  resourceBoxId: number
  costs: Array<{
    shopItemId: number
    seq: number
    cost: CommonResource
  }>
}
