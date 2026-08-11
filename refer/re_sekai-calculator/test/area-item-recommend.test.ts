import { AreaItemRecommend, AreaItemService, type AreaItem, type UserCard } from '../src'
import { TEST_DATA_PROVIDER } from './fixtures/test-data-provider'

test('area item levels and upgrade costs come from the synthetic fixture', async () => {
  const service = new AreaItemService(TEST_DATA_PROVIDER)
  const levels = await service.getAreaItemLevels()
  expect(levels.map(it => [it.areaItemId, it.level])).toEqual([[1, 1]])

  const next = await service.getAreaItemNextLevel({ id: 1 } as AreaItem, levels[0])
  expect(next.level).toBe(2)
  const shopItem = await service.getShopItem(next)
  expect(shopItem.id).toBe(1002)
  expect(shopItem.costs[0].cost.quantity).toBe(2500)
})

test('area item recommendation measures the fixture deck power gain', async () => {
  const userCards = await TEST_DATA_PROVIDER.getUserData<UserCard[]>('userCards')
  const recommend = await new AreaItemRecommend(TEST_DATA_PROVIDER).recommendAreaItem(userCards.slice(0, 5))

  expect(recommend).toHaveLength(1)
  expect(recommend[0]).toMatchObject({
    area: { id: 1 },
    areaItem: { id: 1 },
    areaItemLevel: { level: 2 },
    cost: { coin: 2500, seed: 100, szk: 5 },
    power: 450
  })
})
