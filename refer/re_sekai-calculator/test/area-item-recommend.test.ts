import { AreaItemService, type AreaItem } from '../src'
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
