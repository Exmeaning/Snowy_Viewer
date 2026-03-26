import { CardDetailMap } from './card-detail-map'
import { type DeckCardPowerDetail } from '../deck-information/deck-calculator'

export class CardDetailMapPower extends CardDetailMap<DeckCardPowerDetail> {
  /**
   * 设定单个综合力值
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param sameUnit 是否同组合
   * @param sameAttr 是否同属性
   * @param value 设定的值
   */
  public setPower (unit: string, sameUnit: boolean, sameAttr: boolean, value: DeckCardPowerDetail): void {
    super.set(unit, sameUnit ? 5 : 1, sameAttr ? 5 : 1, value.total, value)
  }

  /**
   * 获取给定情况下的综合力
   * 会返回最合适的值，如果给定的条件与卡牌完全不符会给出异常
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param unitMember 该组合对应的人数（真实值）
   * @param attrMember 卡牌属性对应的人数（真实值）
   */
  public getPower (unit: string, unitMember: number, attrMember: number): DeckCardPowerDetail {
    // 因为实际上的unitMember取值只能是5和1，直接优化掉
    const unitMember0 = unitMember === 5 ? 5 : 1
    // 因为实际上的attrMember取值只能是5和1，直接优化掉
    const attrMember0 = attrMember === 5 ? 5 : 1
    // 直接查询优化后的，减少Map访问次数
    const best = super.getInternal(unit, unitMember0, attrMember0)
    if (best !== undefined) {
      return best
    }
    // 如果这还找不到，说明给的情况就不对
    throw new Error('case not found')
  }
}
