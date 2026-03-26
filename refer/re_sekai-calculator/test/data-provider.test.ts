import { type DataProvider, type MusicMeta, CachedDataProvider } from '../src'
import { readFileSync } from 'fs'

const USE_LOCAL_JSON = true

// 用于测试的用户数据
const mockUserData = JSON.parse(readFileSync('mock-user-data.json', 'utf8'))
const cache = new Map<string, any>()

async function getRemoteJson (url: string): Promise<any> {
  // console.log(url)
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  const json = await res.json()
  cache.set(url, json)
  return json
}

async function getLocalJson (path: string): Promise<any> {
  // console.log(path)
  if (cache.has(path)) return cache.get(path)
  const json = JSON.parse(readFileSync(path, 'utf8'))
  cache.set(path, json)
  return json
}

/**
 * 用于测试的数据源
 */
export class TestDataProvider implements DataProvider {
  public static INSTANCE = new CachedDataProvider(new TestDataProvider())

  async getMasterData<T> (key: string): Promise<T[]> {
    return USE_LOCAL_JSON
      ? await getLocalJson(`sekai-master-db-diff/${key}.json`)
      : await getRemoteJson(`https://sekai-world.github.io/sekai-master-db-diff/${key}.json`)
  }

  async getUserData<T> (key: string): Promise<T> {
    return mockUserData[key]
  }

  async getMusicMeta (): Promise<MusicMeta[]> {
    return USE_LOCAL_JSON
      ? await getLocalJson('music_metas.json')
      : await getRemoteJson('https://storage.sekai.best/sekai-best-assets/music_metas.json')
  }

  async getUserDataAll (): Promise<Record<string, any>> {
    return mockUserData
  }
}

test('master data', async () => {
  const promiseCount = 100
  const promises: Array<Promise<any>> = []
  for (let i = 0; i < promiseCount; ++i) {
    promises.push(TestDataProvider.INSTANCE.getMasterData('gameCharacterUnits'))
  }
  // 检查并行Promise是否全部执行成功
  await Promise.all(promises).then(it => {
    expect(it.length).toBe(100)
    for (let i = 0; i < promiseCount; ++i) {
      expect(it[i].length).not.toBe(0)
    }
  })
})
