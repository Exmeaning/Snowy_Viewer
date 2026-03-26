import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { type CardEpisode } from '../master-data/card-episode'
import { type MasterLesson } from '../master-data/master-lesson'
import { findOrThrow } from '../util/collection-util'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type CharacterRank } from '../master-data/character-rank'
import { type UserCharacter } from '../user-data/user-character'
import { type DeckCardPowerDetail } from '../deck-information/deck-calculator'
import { type CardMysekaiCanvasBonus } from '../master-data/card-mysekai-canvas-bonus'
import type {
  UserMysekaiFixtureGameCharacterPerformanceBonus
} from '../user-data/user-mysekai-fixture-game-character-performance-bonus'
import { type MysekaiGateBonus } from '../mysekai-information/mysekai-service'
import { CardDetailMapPower } from './card-detail-map-power'

export class CardPowerCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 计算在不同情况（组合属性人数不同）下的综合力
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param cardUnits 卡牌所属组合（因为计算逻辑在CardCalculator里面，传参来避免循环构造）
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param hasCanvasBonus 是否拥有自定义世界中的画布
   * @param userGateBonuses 用户拥有的自定义世界大门加成
   * @param mysekaiFixtureLimit My SEKAI家具加成限制（用于World Link Finale）
   */
  public async getCardPower (
    userCard: UserCard, card: Card, cardUnits: string[], userAreaItemLevels: AreaItemLevel[], hasCanvasBonus: boolean,
    userGateBonuses: MysekaiGateBonus[], mysekaiFixtureLimit: number = Number.MAX_SAFE_INTEGER
  ): Promise<CardDetailMapPower> {
    const ret = new CardDetailMapPower()
    // 处理区域道具以外的综合力，这些与队友无关
    const basePower = await this.getCardBasePowers(userCard, card, hasCanvasBonus)
    const characterBonus = await this.getCharacterBonusPower(basePower, card.characterId)
    const fixtureBonus = await this.getFixtureBonusPower(basePower, card.characterId, mysekaiFixtureLimit)
    const gateBonus = await this.getGateBonusPower(basePower, userGateBonuses, cardUnits)
    // 处理区域道具，卡牌的每个组合都需要单独计算
    for (const unit of cardUnits) {
      // 是否相同组合、是否相同属性，计算4种情况
      for (let i = 0; i < 4; ++i) {
        const sameUnit = (i & 1) === 1
        const sameAttr = (i & 2) === 2
        const power = await this.getPower(
          card, basePower, characterBonus, fixtureBonus, gateBonus,
          userAreaItemLevels, unit, sameUnit, sameAttr)
        ret.setPower(unit, sameUnit, sameAttr, power)
      }
    }
    return ret
  }

  /**
   * 获得卡牌在特定情况下的综合力
   * 将基础综合、角色加成、区域道具加成三部分合一
   * @param card 卡牌
   * @param basePower 基础综合
   * @param characterBonus 角色加成
   * @param fixtureBonus 家具加成
   * @param gateBonus 大门加成
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param unit 组合
   * @param sameUnit 是否同组
   * @param sameAttr 是否同色
   * @private
   */
  private async getPower (
    card: Card, basePower: number[], characterBonus: number,
    fixtureBonus: number, gateBonus: number,
    userAreaItemLevels: AreaItemLevel[], unit: string, sameUnit: boolean, sameAttr: boolean
  ): Promise<DeckCardPowerDetail> {
    const base = CardPowerCalculator.sumPower(basePower)
    const areaItemBonus = await this.getAreaItemBonusPower(
      userAreaItemLevels, basePower, card.characterId, unit, sameUnit, card.attr, sameAttr)
    return {
      base,
      areaItemBonus,
      characterBonus,
      fixtureBonus,
      gateBonus,
      total: base + areaItemBonus + characterBonus + fixtureBonus + gateBonus
    }
  }

  /**
   * 获取卡牌基础综合力（含卡牌等级、觉醒、突破等级、前后篇、画布加成），这部分综合力直接显示在卡牌右上角，分为3个子属性
   * @param userCard 用户卡牌（要看卡牌等级、觉醒状态、突破等级、前后篇解锁状态）
   * @param card 卡牌
   * @param hasMysekaiCanvas 是否拥有自定义世界中的画布（影响画布加成）
   * @private
   */
  private async getCardBasePowers (
    userCard: UserCard, card: Card, hasMysekaiCanvas: boolean
  ): Promise<number[]> {
    const [
      cardEpisodes,
      masterLessons
    ] = await Promise.all([
      await this.dataProvider.getMasterData<CardEpisode>('cardEpisodes'),
      await this.dataProvider.getMasterData<MasterLesson>('masterLessons')
    ])

    const ret = [0, 0, 0]
    // 等级
    const cardParameters = card.cardParameters
      .filter(it => it.cardLevel === userCard.level)
    const params = ['param1', 'param2', 'param3']// cardParameterType的枚举
    params.forEach((param, i) => {
      ret[i] = findOrThrow(cardParameters, it => it.cardParameterType === param).power
    })
    // 觉醒
    if (userCard.specialTrainingStatus === 'done') {
      ret[0] += card.specialTrainingPower1BonusFixed
      ret[1] += card.specialTrainingPower2BonusFixed
      ret[2] += card.specialTrainingPower3BonusFixed
    }
    // 剧情
    const episodes = userCard.episodes === undefined
      ? []// 有些卡没剧情
      : userCard.episodes.filter(it => it.scenarioStatus === 'already_read')
        .map(it =>
          findOrThrow(cardEpisodes, e => e.id === it.cardEpisodeId))
    for (const episode of episodes) {
      ret[0] += episode.power1BonusFixed
      ret[1] += episode.power2BonusFixed
      ret[2] += episode.power3BonusFixed
    }
    // 突破
    const usedMasterLessons = masterLessons
      .filter((it: any) => it.cardRarityType === card.cardRarityType && it.masterRank <= userCard.masterRank)
    for (const masterLesson of usedMasterLessons) {
      ret[0] += masterLesson.power1BonusFixed
      ret[1] += masterLesson.power2BonusFixed
      ret[2] += masterLesson.power3BonusFixed
    }
    // 从5.1.0版本开始，画布加成直接算进基础综合力中
    if (hasMysekaiCanvas) {
      const cardMysekaiCanvasBonuses = await this.dataProvider.getMasterData<CardMysekaiCanvasBonus>('cardMysekaiCanvasBonuses')
      const canvasBonus = findOrThrow(cardMysekaiCanvasBonuses, it => it.cardRarityType === card.cardRarityType)
      ret[0] += canvasBonus.power1BonusFixed
      ret[1] += canvasBonus.power2BonusFixed
      ret[2] += canvasBonus.power3BonusFixed
    }
    return ret
  }

  /**
   * 获得区域道具加成的综合力
   * @param userAreaItemLevels 用户所持的区域道具等级
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @param unit 用于加成的组合
   * @param sameUnit 是否同组合
   * @param attr 用于加成的属性
   * @param sameAttr 是否同属性
   * @private
   */
  private async getAreaItemBonusPower (
    userAreaItemLevels: AreaItemLevel[], basePower: number[],
    characterId: number, unit: string, sameUnit: boolean, attr: string, sameAttr: boolean
  ): Promise<number> {
    // 筛选可以使用的区域道具
    const usedAreaItems = userAreaItemLevels.filter(it =>
      (it.targetUnit === 'any' || it.targetUnit === unit) &&
      (it.targetCardAttr === 'any' || it.targetCardAttr === attr) &&
      (it.targetGameCharacterId === undefined || it.targetGameCharacterId === characterId)
    )
    // 累加各个区域道具的加成
    const areaItemBonus = [0, 0, 0]
    for (const areaItem of usedAreaItems) {
      const allMatch = (areaItem.targetUnit !== 'any' && sameUnit) ||
        (areaItem.targetCardAttr !== 'any' && sameAttr)
      const rates = [
        allMatch ? areaItem.power1AllMatchBonusRate : areaItem.power1BonusRate,
        allMatch ? areaItem.power2AllMatchBonusRate : areaItem.power2BonusRate,
        allMatch ? areaItem.power3AllMatchBonusRate : areaItem.power3BonusRate
      ]
      rates.forEach((rate, i) => {
        areaItemBonus[i] = Math.fround(areaItemBonus[i] +
          Math.fround(Math.fround(Math.fround(rate) * Math.fround(0.01)) * basePower[i]))
      })
    }
    // 三个维度单独计算后向下取整再累加
    return areaItemBonus.reduce((v, it) => v + Math.floor(it), 0)
  }

  /**
   * 获取卡牌角色加成综合力
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @private
   */
  private async getCharacterBonusPower (basePower: number[], characterId: number): Promise<number> {
    const characterRanks = await this.dataProvider.getMasterData<CharacterRank>('characterRanks')
    const userCharacters = await this.dataProvider.getUserData<UserCharacter[]>('userCharacters')

    const userCharacter =
      findOrThrow(userCharacters, it => it.characterId === characterId)
    const characterRank = findOrThrow(characterRanks,
      it => it.characterId === userCharacter.characterId &&
        it.characterRank === userCharacter.characterRank)
    const rates = [
      characterRank.power1BonusRate,
      characterRank.power2BonusRate,
      characterRank.power3BonusRate
    ]
    return rates
      .reduce((v, it, i) => v +
        Math.floor(Math.fround(Math.fround(Math.fround(it) * Math.fround(0.01)) * basePower[i])), 0)
  }

  /**
   * 计算自定义世界中的家具加成（玩偶）
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @param mysekaiFixtureLimit My SEKAI家具加成限制（用于World Link Finale）
   */
  private async getFixtureBonusPower (
    basePower: number[], characterId: number, mysekaiFixtureLimit: number = Number.MAX_SAFE_INTEGER
  ): Promise<number> {
    const userFixtureBonuses =
        await this.dataProvider.getUserData<UserMysekaiFixtureGameCharacterPerformanceBonus[]>(
          'userMysekaiFixtureGameCharacterPerformanceBonuses')
    if (userFixtureBonuses === undefined || userFixtureBonuses === null || userFixtureBonuses.length === 0) {
      return 0
    }

    // 寻找对应的加成，如果没有任何加成会空
    const fixtureBonus = userFixtureBonuses
      .find(it => it.gameCharacterId === characterId)
    if (fixtureBonus === undefined) {
      return 0
    }

    // 给World Link Finale家具加成做封顶
    const bonus = Math.min(fixtureBonus.totalBonusRate, mysekaiFixtureLimit)

    // 按各个综合分别计算加成，其中totalBonusRate单位是0.1%
    return Math.floor(Math.fround(CardPowerCalculator.sumPower(basePower) *
        Math.fround(Math.fround(bonus) * Math.fround(0.001))))
  }

  /**
   * 自定义世界的大门加成
   * 如果是无应援的V家角色，按最大加成算
   * @param basePower 基础综合
   * @param userGateBonuses 当前生效的门加成
   * @param cardUnits 当前卡有的组合
   */
  private async getGateBonusPower (
    basePower: number[], userGateBonuses: MysekaiGateBonus[], cardUnits: string[]
  ): Promise<number> {
    // 因为没有专门的V家加成，需要特殊判定无应援的V家角色
    const isOnlyPiapro = cardUnits.length === 1 && cardUnits[0] === 'piapro'
    // 找到可以使用的最高加成
    let powerBonusRate = 0
    for (const bonus of userGateBonuses) {
      if (isOnlyPiapro || cardUnits.includes(bonus.unit)) {
        powerBonusRate = Math.max(powerBonusRate, bonus.powerBonusRate)
      }
    }
    // 按各个综合分别计算加成，其中powerBonusRate单位是1%
    return Math.floor(Math.fround(CardPowerCalculator.sumPower(basePower) *
        Math.fround(Math.fround(powerBonusRate) * Math.fround(0.01))))
  }

  /**
   * 求和综合力
   * @param power 三维
   * @private
   */
  private static sumPower (power: number[]): number {
    return power.reduce((v, it) => v + it, 0)
  }
}
