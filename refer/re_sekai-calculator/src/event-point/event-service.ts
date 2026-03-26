import { type DataProvider } from '../data-provider/data-provider'
import { type Event } from '../master-data/event'
import { findOrThrow } from '../util/collection-util'
import { type EventDeckBonus } from '../master-data/event-deck-bonus'
import { type GameCharacterUnit } from '../master-data/game-character-unit'
import type { WorldBloomDifferentAttributeBonus } from '../master-data/world-bloom-different-attribute-bonus'
import { type EventCardBonusLimit } from '../master-data/event-card-bonus-limit'
import type { EventSkillScoreUpLimit } from '../master-data/event-skill-score-up-limit'
import {
  type EventMysekaiFixtureGameCharacterPerformanceBonusLimit
} from '../master-data/event-mysekai-fixture-game-character-performance-bonus-limit'
import type { GameCharacter } from '../master-data/game-character'
import { type WorldBloom } from '../master-data/world-bloom'
import type { CustomBonusConfig } from '../common/custom-bonus'

export class EventService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取活动类型
   * @param eventId 活动ID
   */
  public async getEventType (eventId: number): Promise<EventType> {
    const events = await this.dataProvider.getMasterData<Event>('events')
    const event = findOrThrow(events, it => it.id === eventId)
    switch (event.eventType) {
      case 'marathon':
        return EventType.MARATHON
      case 'cheerful_carnival':
        return EventType.CHEERFUL
      case 'world_bloom':
        return EventType.BLOOM
      default:
        throw new Error(`Event type ${event.eventType} not found.`)
    }
  }

  /**
   * 获取活动设置
   * @param eventId 活动ID
   * @param specialCharacterId 特别选择的角色ID（用于World Link活动）
   */
  public async getEventConfig (eventId: number, specialCharacterId?: number): Promise<EventConfig> {
    const eventType = await this.getEventType(eventId)
    const isWorldBloom = eventType === EventType.BLOOM
    const worldBloomType = isWorldBloom ? await this.getWorldBloomType(eventId) : undefined
    const isWorldBloomFinale = EventService.isWorldBloomFinale(worldBloomType)
    return {
      eventId,
      eventType,
      eventUnit: await this.getEventBonusUnit(eventId),
      specialCharacterId,
      cardBonusCountLimit: isWorldBloomFinale ? await this.getEventCardBonusCountLimit(eventId) : 5,
      skillScoreUpLimit: Number.MAX_SAFE_INTEGER, // 此项未实际使用
      mysekaiFixtureLimit: isWorldBloomFinale ? await this.getMysekaiFixtureLimit(eventId) : Number.MAX_SAFE_INTEGER,
      worldBloomDifferentAttributeBonuses:
          isWorldBloom ? await this.getWorldBloomDifferentAttributeBonuses() : undefined,
      worldBloomType,
      worldBloomSupportUnit: isWorldBloom ? await this.getWorldBloomSupportUnit(specialCharacterId) : undefined
    }
  }

  /**
   * 获取箱活的加成团队
   * V家活动返回piapro
   * 如果非箱活，会返回undefined
   * @param eventId 活动ID
   */
  public async getEventBonusUnit (eventId: number): Promise<string | undefined> {
    const eventDeckBonuses =
      await this.dataProvider.getMasterData<EventDeckBonus>('eventDeckBonuses')
    const gameCharacterUnits =
      await this.dataProvider.getMasterData<GameCharacterUnit>('gameCharacterUnits')
    const gameCharacters = await this.dataProvider.getMasterData<GameCharacter>('gameCharacters')
    const bonuses = eventDeckBonuses
      .filter(it => it.eventId === eventId && it.gameCharacterUnitId !== undefined)
      .map(it =>
        findOrThrow(gameCharacterUnits, a => a.id === it.gameCharacterUnitId))
    // 用Map统计每个组合数量
    const map = new Map<string, number>()
    bonuses.forEach(gcu => {
      const gameCharacter =
            findOrThrow(gameCharacters, it => it.id === gcu.gameCharacterId)
      // 角色原始组合
      map.set(gameCharacter.unit, (map.get(gameCharacter.unit) ?? 0) + 1)
      // VS应援组合
      if (gameCharacter.unit !== gcu.unit) {
        map.set(gcu.unit, (map.get(gcu.unit) ?? 0) + 1)
      }
    })
    for (const [key, value] of map) {
      // 如果当前所有加成角色都在某一个组合，这个组合自然就是箱活组合
      if (value === bonuses.length) {
        return key
      }
    }
    return undefined
  }

  /**
   * 获得World Link活动不同属性加成
   */
  public async getWorldBloomDifferentAttributeBonuses (): Promise<WorldBloomDifferentAttributeBonus[]> {
    return await this.dataProvider
      .getMasterData<WorldBloomDifferentAttributeBonus>('worldBloomDifferentAttributeBonuses')
  }

  /**
   * 获得特定卡牌加成数量限制（用于World Link Finale）
   */
  public async getEventCardBonusCountLimit (eventId: number): Promise<number> {
    const limits = await this.dataProvider
      .getMasterData<EventCardBonusLimit>('eventCardBonusLimits')
    const limit = limits.find(it => it.eventId === eventId)
    return limit?.memberCountLimit ?? 5 // 默认全加成
  }

  /**
   * 获得World Link Finale卡牌技能限制（技能实际加成比例）
   * 此项限制实际没有用上，用修改技能数值的方式做了限制
   * @param eventId 活动ID
   */
  public async getEventSkillScoreUpLimit (eventId: number): Promise<number> {
    const limits =
        await this.dataProvider.getMasterData<EventSkillScoreUpLimit>('eventSkillScoreUpLimits')
    const limit =
        limits.find(it => it.eventId === eventId)
    if (limit === undefined) {
      return Number.MAX_SAFE_INTEGER
    }
    return limit.scoreUpRateLimit
  }

  /**
   * 获得World Link Finale My SEKAI家具加成限制
   * @param eventId 活动ID
   */
  public async getMysekaiFixtureLimit (eventId: number): Promise<number> {
    const limits = await this.dataProvider
      .getMasterData<EventMysekaiFixtureGameCharacterPerformanceBonusLimit>(
      'eventMysekaiFixtureGameCharacterPerformanceBonusLimits'
    )
    const limit =
        limits.find(it => it.eventId === eventId)
    return limit?.bonusRateLimit ?? Number.MAX_SAFE_INTEGER
  }

  /**
   * 获得World Link活动类型
   * 可能的返回值：undefined（非World Link）、"game_character"（普通）、"finale"（Final）
   * @param eventId
   */
  public async getWorldBloomType (eventId: number): Promise<string | undefined> {
    const worldBlooms =
        await this.dataProvider.getMasterData<WorldBloom>('worldBlooms')
    const worldBloom = worldBlooms.find(it => it.eventId === eventId)
    return worldBloom?.worldBloomChapterType
  }

  /**
   * 获得World Link应援角色对应的组合（只看原始组合）
   * @param specialCharacterId 支援角色
   */
  public async getWorldBloomSupportUnit (specialCharacterId?: number): Promise<string | undefined> {
    if (specialCharacterId === undefined) {
      return undefined
    }
    const gameCharacters = await this.dataProvider.getMasterData<GameCharacter>('gameCharacters')
    const gameCharacter = findOrThrow(gameCharacters, it => it.id === specialCharacterId)
    return gameCharacter.unit
  }

  /**
   * 判断是否为World Link Final活动
   * @param worldBloomType World Link类型
   */
  public static isWorldBloomFinale (worldBloomType?: string): boolean {
    return worldBloomType === 'finale'
  }
}

/**
 * 活动类型
 */
export enum EventType {
  NONE = 'none',
  MARATHON = 'marathon',
  CHEERFUL = 'cheerful_carnival',
  BLOOM = 'world_bloom',
}

/**
 * 活动信息设置
 */
export interface EventConfig {
  /**
   * 活动ID
   */
  eventId?: number
  /**
   * 活动类型
   */
  eventType?: EventType
  /**
   * 箱活的团队
   */
  eventUnit?: string
  /**
   * 特殊角色ID（用于World Link活动）
   */
  specialCharacterId?: number
  /**
   * 特定卡牌加成数量限制（用于World Link Finale）
   */
  cardBonusCountLimit?: number
  /**
   * 加分技能限制（用于World Link Finale）
   */
  skillScoreUpLimit?: number
  /**
   * My SEKAI家具加成限制（用于World Link Finale）
   */
  mysekaiFixtureLimit?: number
  /**
   * 不同属性加成（用于World Link活动）
   */
  worldBloomDifferentAttributeBonuses?: WorldBloomDifferentAttributeBonus[]
  /**
   * World Link类型
   * game_character（普通）、finale（Final）
   */
  worldBloomType?: string
  /**
   * 支援角色组合，和specialCharacterId保持一致（用于World Link活动）
   */
  worldBloomSupportUnit?: string

  /**
   * 自定义加成配置
   * 允许用户为不同组合/角色指定额外的活动加成
   */
  customBonuses?: CustomBonusConfig
}
