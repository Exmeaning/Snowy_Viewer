import { type DataProvider } from './data-provider'
import { getOrThrow } from '../util/collection-util'
import { type MusicMeta } from '../common/music-meta'

/**
 * 缓存数据，解决数据重复加载问题，支持并行Promise
 */
export class CachedDataProvider implements DataProvider {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  private static readonly globalCache = new Map<string, any>()
  private readonly instanceCache = new Map<string, any>()
  private static readonly runningPromise = new Map<string, Promise<any>>()

  private async getData (cache: Map<string, any>, cacheKey: string, promise: () => Promise<any>): Promise<any> {
    // 如果本来就有缓存，不需要通过promise获取数据
    if (cache.has(cacheKey)) return cache.get(cacheKey)
    // 等待之前的promise执行完成
    while (CachedDataProvider.runningPromise.has(cacheKey)) {
      await CachedDataProvider.runningPromise.get(cacheKey)
    }
    // 再次检查是否存在缓存（之前的Promise执行结果）
    if (cache.has(cacheKey)) return cache.get(cacheKey)

    // 生成并执行新的promise，将结果写入缓存
    CachedDataProvider.runningPromise.set(cacheKey, promise())
    const data = await getOrThrow(CachedDataProvider.runningPromise, cacheKey).then(data => {
      cache.set(cacheKey, data)
      return data
    })
    CachedDataProvider.runningPromise.delete(cacheKey)
    return data
  }

  public async getMasterData<T> (key: string): Promise<T[]> {
    return await this.getData(CachedDataProvider.globalCache, key,
      async () => await this.dataProvider.getMasterData(key))
  }

  public async getMusicMeta (): Promise<MusicMeta[]> {
    return await this.getData(CachedDataProvider.globalCache, 'musicMeta',
      async () => await this.dataProvider.getMusicMeta())
  }

  public async getUserData<T> (key: string): Promise<T> {
    const allData = await this.getUserDataAll()
    return allData[key]
  }

  public async getUserDataAll (): Promise<Record<string, any>> {
    return await this.getData(this.instanceCache, 'userData',
      async () => await this.dataProvider.getUserDataAll())
  }

  /**
   * 并行预加载Master Data，避免后续计算时阻塞
   * @param keys 需要加载的key
   */
  public async preloadMasterData (keys: string[]): Promise<any[]> {
    return await Promise.all(keys.map(async it => await this.getMasterData(it)))
  }
}
