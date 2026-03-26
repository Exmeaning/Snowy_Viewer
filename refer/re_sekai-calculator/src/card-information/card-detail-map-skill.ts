import { CardDetailMap } from './card-detail-map'
import type { DeckCardSkillDetailPrepare } from './card-skill-calculator'

export class CardDetailMapSkill extends CardDetailMap<DeckCardSkillDetailPrepare> {
  /** 花前技能独立存储 */
  private readonly preTrainingMap = new CardDetailMap<DeckCardSkillDetailPrepare>()
  /** 是否存在花前技能（与花後不同的技能） */
  private _hasPreTraining = false

  public get hasPreTraining (): boolean {
    return this._hasPreTraining
  }

  /**
   * 设定花後（或唯一）技能值
   * @param unit 组合标识 (any/ref/diff/具体组合名)
   * @param unitMember 组合人数
   * @param attrMember 属性人数
   * @param cmpValue 用于剪枝的可比较值
   * @param value 实际值
   */
  public setSkill (unit: string, unitMember: number, attrMember: number, cmpValue: number, value: DeckCardSkillDetailPrepare): void {
    super.set(unit, unitMember, attrMember, cmpValue, value)
  }

  /**
   * 设定花前技能值（仅当花前花後技能不同时使用）
   */
  public setPreTrainingSkill (unit: string, unitMember: number, attrMember: number, cmpValue: number, value: DeckCardSkillDetailPrepare): void {
    this.preTrainingMap.setPublic(unit, unitMember, attrMember, cmpValue, value)
    this._hasPreTraining = true
  }

  /**
   * 获取花後（或唯一）技能
   */
  public getSkill (unit: string, unitMember: number): DeckCardSkillDetailPrepare {
    return CardDetailMapSkill.resolveSkill(this, unit, unitMember)
  }

  /**
   * 获取花前技能
   */
  public getPreTrainingSkill (unit: string, unitMember: number): DeckCardSkillDetailPrepare {
    if (!this._hasPreTraining) {
      throw new Error('no pre-training skill')
    }
    return CardDetailMapSkill.resolveSkill(this.preTrainingMap, unit, unitMember)
  }

  /**
   * 从指定 map 中按优先级查找技能
   */
  private static resolveSkill (map: CardDetailMap<DeckCardSkillDetailPrepare>, unit: string, unitMember: number): DeckCardSkillDetailPrepare {
    // 吸技能
    if (unit === 'ref') {
      const best = map.getInternal('ref', 1, 1)
      if (best !== undefined) return best
    }

    // 异组技能
    if (unit === 'diff') {
      const best = map.getInternal('diff', Math.min(2, unitMember), 1)
      if (best !== undefined) return best
    }

    // 与当前组合相关的技能（组分）
    const best = map.getInternal(unit, unitMember, 1)
    if (best !== undefined) return best

    // 固定数值技能（保底）
    const fallback = map.getInternal('any', 1, 1)
    if (fallback !== undefined) return fallback

    throw new Error('case not found')
  }
}
