import { CardDetailMap } from './card-detail-map'
import { type CardEventBonusDetail } from '../event-point/card-event-calculator'

export class CardDetailMapEventBonus extends CardDetailMap<CardEventBonusDetail> {
  private bonus?: CardEventBonusDetail = undefined
  /**
   * 设定活动加成值
   * @param value 设定的值
   */
  public setBonus (value: CardEventBonusDetail): void {
    super.updateMinMax(value.fixedBonus) // 加成最小值
    super.updateMinMax(value.fixedBonus + value.cardBonus + value.leaderBonus) // 拉满的最大加成
    this.bonus = value // 因为只有一种可能性，不需要放入Map
  }

  /**
   * 获取活动加成值
   */
  public getBonus (): CardEventBonusDetail {
    // 只有一种可能性
    if (this.bonus !== undefined) {
      return this.bonus
    }
    // 如果这还找不到，说明给的情况就不对
    throw new Error('bonus not found')
  }

  /**
   * 获得用于展示的值（绝对不可以用于计算）
   * 计算时必须要考虑卡牌加成数量限制
   */
  public getBonusForDisplay (leader: boolean): string {
    return this.getMaxBonus(leader).toString()
  }

  /**
   * 最大加成
   */
  public getMaxBonus (leader: boolean): number {
    const bonus = this.getBonus()
    return bonus.fixedBonus + bonus.cardBonus + (leader ? bonus.leaderBonus : 0)
  }
}
