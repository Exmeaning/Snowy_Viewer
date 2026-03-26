import { type MusicMeta } from '../common/music-meta'

/**
 * 数据获取接口
 */
export interface DataProvider {
  /**
   * 获得Master Data
   * @param key
   */
  getMasterData: <T>(key: string) => Promise<T[]>
  /**
   * 获得所有用户数据
   */
  getUserDataAll: () => Promise<Record<string, any>>
  /**
   * 获得用户数据
   * @param key
   */
  getUserData: <T>(key: string) => Promise<T>
  /**
   * 获取歌曲数据
   */
  getMusicMeta: () => Promise<MusicMeta[]>
}
