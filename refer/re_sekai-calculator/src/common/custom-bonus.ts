/**
 * 自定义加成配置
 *
 * 允许用户为不同组合的角色指定自定义活动加成百分比。
 * 虚拟歌手（piapro）的卡牌可以通过 supportUnit 区分不同应援组合。
 *
 * 加成会作为额外的 fixedBonus 叠加到活动加成中。
 * 如果没有活动（eventId 为空），则作为独立的活动加成使用。
 */

/**
 * 单条自定义加成规则
 */
export interface CustomBonusRule {
  /**
   * 目标组合（角色所属组合）
   * 兼容两套命名：
   * - 旧命名：'leo_need' | 'more_more_jump' | 'vivid_bad_squad' | 'wonderlands_showtime' | 'nightcord_at_25' | 'piapro'
   * - 新命名：'light_sound' | 'idol' | 'street' | 'theme_park' | 'school_refusal' | 'piapro'
   * 设为 'any' 表示匹配所有组合
   */
  unit: string

  /**
   * 虚拟歌手的应援组合（仅对 piapro 角色有效）
   * 例如：'leo_need' 或 'light_sound' 表示应援 Leo/need 的虚拟歌手卡
   * 设为 'none' 表示无应援的虚拟歌手卡
   * 设为 'any' 或 undefined 表示匹配所有应援组合
   */
  supportUnit?: string

  /**
   * 目标属性
   * 'cool' | 'cute' | 'happy' | 'mysterious' | 'pure'
   * 设为 'any' 或 undefined 表示匹配所有属性
   */
  attr?: string

  /**
   * 目标角色ID（可选，精确匹配单个角色）
   * 如果指定，则只对该角色生效，忽略 unit/supportUnit
   */
  characterId?: number

  /**
   * 加成百分比（与活动加成单位一致）
   * 例如：25 表示 25% 加成
   */
  bonusRate: number
}

/**
 * 自定义加成配置
 */
export interface CustomBonusConfig {
  /**
   * 自定义加成规则列表
   * 同一张卡可以匹配多条规则，加成会累加
   */
  rules: CustomBonusRule[]
}
