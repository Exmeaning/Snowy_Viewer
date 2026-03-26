import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type ShopItem } from '../master-data/shop-item'
import { findOrThrow } from '../util/collection-util'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type Area } from '../master-data/area'
import { type AreaItem } from '../master-data/area-item'
import { DeckCalculator } from '../deck-information/deck-calculator'

export class AreaItemRecommend {
  private readonly areaItemService: AreaItemService
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.areaItemService = new AreaItemService(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 从升级区域道具所需的资源中找到指定的资源数量
   * @param shopItem 区域道具商店道具
   * @param resourceType 资源类型
   * @param resourceId 资源ID
   * @private
   */
  private static findCost (shopItem: ShopItem, resourceType: string, resourceId?: number): number {
    const cost = shopItem.costs.map(it => it.cost)
      .find(it => it.resourceType === resourceType && it.resourceId === resourceId)
    return cost === undefined ? 0 : cost.quantity
  }

  /**
   * 获取推荐区域道具
   * @param areaItem 区域道具
   * @param areaItemLevel 升级1级后的区域道具等级
   * @param power 区域道具升1级增加的综合
   * @private
   */
  private async getRecommendAreaItem (
    areaItem: AreaItem, areaItemLevel: AreaItemLevel, power: number
  ): Promise<RecommendAreaItem> {
    const areas = await this.dataProvider.getMasterData<Area>('areas')
    const area = findOrThrow(areas, it => it.id === areaItem.areaId)
    const shopItem = await this.areaItemService.getShopItem(areaItemLevel)
    return {
      area,
      areaItem,
      areaItemLevel,
      shopItem,
      cost: {
        coin: AreaItemRecommend.findCost(shopItem, 'coin', 0),
        seed: AreaItemRecommend.findCost(shopItem, 'material', 17),
        szk: AreaItemRecommend.findCost(shopItem, 'material', 57)
      },
      power
    }
  }

  /**
   * 获取推荐区域道具
   * 按「综合/金币」倒序排序
   * @param userCards 需要计算的卡组
   */
  public async recommendAreaItem (userCards: UserCard[]): Promise<RecommendAreaItem[]> {
    const areaItems = await this.dataProvider.getMasterData<AreaItem>('areaItems')
    const currentAreaItemLevels = await this.areaItemService.getAreaItemLevels()
    const { power: currentPower } =
      await this.deckCalculator.getDeckDetail(userCards, userCards, {}, currentAreaItemLevels)
    const recommend = await Promise.all(areaItems.map(async areaItem => {
      const newAreaItemLevel = await this.areaItemService.getAreaItemNextLevel(
        areaItem, currentAreaItemLevels.find(it => it.areaItemId === areaItem.id)
      )
      const newAreaItemLevels = [
        ...currentAreaItemLevels.filter(it => it.areaItemId !== areaItem.id), newAreaItemLevel
      ]
      const { power: newPower } =
        await this.deckCalculator.getDeckDetail(userCards, userCards, {}, newAreaItemLevels)
      return await this.getRecommendAreaItem(areaItem, newAreaItemLevel, newPower.total - currentPower.total)
    }))
    return recommend.filter(it => it.power > 0)
      .sort((a, b) => b.power / b.cost.coin - a.power / a.cost.coin)
  }
}

export interface RecommendAreaItem {
  area: Area
  areaItem: AreaItem
  areaItemLevel: AreaItemLevel
  shopItem: ShopItem
  cost: {
    coin: number
    seed: number
    szk: number
  }
  power: number
}
