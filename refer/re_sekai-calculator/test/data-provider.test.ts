import { CachedDataProvider } from '../src'
import { DeterministicDataProvider } from './fixtures/test-data-provider'

test('master data reads are deterministic and concurrent calls share one load', async () => {
  const source = new DeterministicDataProvider()
  const provider = new CachedDataProvider(source)
  const results = await Promise.all(Array.from({ length: 100 }, async () =>
    await provider.getMasterData('gameCharacterUnits')))

  expect(results).toHaveLength(100)
  results.forEach(result => expect(result).toHaveLength(1))
  expect(source.masterDataReads).toBe(1)
})
