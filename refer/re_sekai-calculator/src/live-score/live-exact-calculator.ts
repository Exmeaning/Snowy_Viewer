import type { DataProvider } from '../data-provider/data-provider'
import { type MusicNoteBase, type MusicScore } from '../common/music-score'
import { LiveCalculator, LiveType } from './live-calculator'
import { type IngameCombo } from '../master-data/ingame-combo'
import { type IngameNote } from '../master-data/ingame-note'
import { findOrThrow } from '../util/collection-util'

export class LiveExactCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 计算每个Note的精准分数
   * 计算时间与Note数正相关
   * 多人Live必然会存在技能、Fever延迟问题，精算意义不大
   * @param power 卡组综合力（以卡组界面显示为准）
   * @param skills 技能（实际效果）
   * @param liveType Live类型
   * @param musicScore 游玩的谱面
   * @param multiSumPower 多人5人的综合力总和
   * @param feverMusicScore 多人房主的谱面（可选）
   */
  public async calculate (
    power: number, skills: number[], liveType: LiveType,
    musicScore: MusicScore, multiSumPower: number = power * 5, feverMusicScore: MusicScore = musicScore
  ): Promise<LiveExactDetail> {
    // 获得游戏内加成信息
    const effects = LiveExactCalculator.getSkillDetails(skills, musicScore.skills)
    if (liveType === LiveType.MULTI || liveType === LiveType.CHEERFUL) {
      // 多人Live还需要考虑Fever效果，按时间排序加进effect
      const feverDetail = LiveExactCalculator.getFeverDetail(feverMusicScore)
      effects.push(feverDetail)
    }
    // 全note权重计算
    const ingameNodes = await this.dataProvider.getMasterData<IngameNote>('ingameNodes')
    const noteCoefficients = musicScore.notes
      .map(note => findOrThrow(ingameNodes, it => it.id === note.type).scoreCoefficient)
    const coefficientTotal = noteCoefficients.reduce((total, it) => total + it, 0)
    // 单note单独计算
    const ingameCombos = await this.dataProvider.getMasterData<IngameCombo>('ingameCombos')
    const notes = musicScore.notes.map((note, i) => {
      // Note基本分数
      const noteCoefficient = noteCoefficients[i]
      // Combo加成
      const combo = i + 1 // 下标从0开始
      const comboCoefficient = findOrThrow(ingameCombos,
        it => it.fromCount <= combo && combo <= it.toCount).scoreCoefficient
      // 判定加成
      const judgeCoefficient = 1 // PERFECT
      // 效果加成（累乘）
      const effectBonuses = effects
        .filter(it => it.startTime <= note.time && note.time <= it.endTime)
        .map(it => it.effect)
      const effectCoefficient = effectBonuses
        .reduce((total, it) => total * (it / 100), 1)
      // 计算最终分数
      const score = noteCoefficient * comboCoefficient * judgeCoefficient * effectCoefficient * power * 4 / coefficientTotal
      return {
        noteCoefficient,
        comboCoefficient,
        judgeCoefficient,
        effectBonuses,
        score
      }
    })
    const noteTotal = notes.reduce((a, b) => a + b.score, 0)
    // 独立的活跃加成
    const activeBonus = liveType === LiveType.MULTI
      ? 5 * LiveCalculator.getMultiActiveBonus(multiSumPower)
      : 0
    return {
      total: noteTotal + activeBonus,
      activeBonus,
      notes
    }
  }

  /**
   * 获得技能对象
   * @param skills 技能（实际效果）
   * @param musicSkills 谱面中的技能
   * @private
   */
  private static getSkillDetails (skills: number[], musicSkills: MusicNoteBase[]): IngameEffectDetail[] {
    return musicSkills.map((it, i) => {
      return {
        startTime: it.time,
        endTime: it.time + 5, // 固定5秒
        effect: skills[i]
      }
    })
  }

  /**
   * 获得Fever对象
   * 请注意：多人游戏的Fever准备、开始、结束时间均取决于房主（一号位）谱面，与实际游玩谱面无关
   * @param musicScore 解析过的谱面
   * @private
   */
  private static getFeverDetail (musicScore: MusicScore): IngameEffectDetail {
    if (musicScore.fevers === undefined || musicScore.fevers.length === 0) {
      // Long歌曲只能单人游玩，没有Fever
      return {
        startTime: 0,
        endTime: 0,
        effect: 0
      }
    }
    // Fever由Prepare和Start阶段组成，时间靠后的是Fever Start
    const startTime = musicScore.fevers
      .reduce((v, it) => Math.max(v, it.time), 0)
    // Fever的结束时间是从Fever Start开始，找到全谱面10%Note数量的Note位置，这个Note的时间就是Fever结束时间
    const notesAfterFever = musicScore.notes
      .filter(note => note.time >= startTime)
    const feverNoteCount =
        Math.min(notesAfterFever.length, Math.floor(musicScore.notes.length / 10)) // 10%位置但不超过谱面结尾
    const endTime = notesAfterFever[feverNoteCount - 1].time
    return {
      startTime,
      endTime,
      effect: 50 // Fever固定50%加成
    }
  }
}

export interface LiveExactDetail {
  total: number
  activeBonus: number
  notes: LiveNoteDetail[]
}

export interface LiveNoteDetail {
  noteCoefficient: number
  comboCoefficient: number
  judgeCoefficient: number
  effectBonuses: number[]
  score: number
}

interface IngameEffectDetail {
  startTime: number
  endTime: number
  effect: number
}
