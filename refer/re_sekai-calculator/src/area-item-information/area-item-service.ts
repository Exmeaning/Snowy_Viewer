import { type DataProvider } from '../data-provider/data-provider'
import { type UserArea } from '../user-data/user-area'
import { findOrThrow } from '../util/collection-util'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type AreaItem } from '../master-data/area-item'
import { type ShopItem } from '../master-data/shop-item'

export class AreaItemService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取用户纳入计算的区域道具
   */
  public async getAreaItemLevels (): Promise<AreaItemLevel[]> {
    const userAreas = await this.dataProvider.getUserData<UserArea[]>('userAreas')
    return await Promise.all(userAreas.flatMap(it => it.areaItems)
      .map(async it => await this.getAreaItemLevel(it.areaItemId, it.level)))
  }

  /**
   * 获取对应等级的区域道具
   * @param areaItemId 区域道具ID
   * @param level 等级
   */
  public async getAreaItemLevel (areaItemId: number, level: number): Promise<AreaItemLevel> {
    const areaItemLevels = await this.dataProvider.getMasterData<AreaItemLevel>('areaItemLevels')
    return findOrThrow(areaItemLevels, it => it.areaItemId === areaItemId && it.level === level)
  }

  /**
   * 获取下一级区域道具
   * 目前只支持1～15级
   * @param areaItem 区域道具
   * @param areaItemLevel （可选）当前等级
   * @private
   */
  public async getAreaItemNextLevel (areaItem: AreaItem, areaItemLevel?: AreaItemLevel): Promise<AreaItemLevel> {
    // 如果没有给定当前等级，就按未购买算、如果已经15级了下个等级还是15级
    const level = areaItemLevel === undefined ? 1 : (areaItemLevel.level === 15 ? 15 : areaItemLevel.level + 1)
    return await this.getAreaItemLevel(areaItem.id, level)
  }

  /**
   * 获取区域道具等级对应的ShopItem
   * 按理来说应该先去resourceBoxes中找到道具等级对应的ID，再通过resourceBoxId获取ShopItem
   * 但是为了这么简单的需求获取一个11MB的resourceBoxes纯属想不开，所以就自己找规律推一下了
   * 目前只支持1～15级
   * @param areaItemLevel 区域道具等级
   * @private
   */
  public async getShopItem (areaItemLevel: AreaItemLevel): Promise<ShopItem> {
    const shopItems = await this.dataProvider.getMasterData<ShopItem>('shopItems')
    // 目前的规律是1-10级按顺序在1001～1550、11-15级在1551～1825
    const idOffset = areaItemLevel.level <= 10
      ? (1000 + (areaItemLevel.areaItemId - 1) * 10)
      : (1550 - 10 + (areaItemLevel.areaItemId - 1) * 5)
    const id = idOffset + areaItemLevel.level
    return findOrThrow(shopItems, it => it.id === id)
  }
}
