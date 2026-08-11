import { readFileSync } from 'fs'
import { join } from 'path'

import { CachedDataProvider, type DataProvider, type MusicMeta } from '../../src'

interface CalculatorFixture {
  masterData: Record<string, unknown[]>
  userData: Record<string, unknown>
  musicMeta: MusicMeta[]
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'test/fixtures/calculator.fixture.json'), 'utf8')
) as CalculatorFixture

function clone<T> (value: T): T {
  return structuredClone(value)
}

export class DeterministicDataProvider implements DataProvider {
  public masterDataReads = 0

  async getMasterData<T> (key: string): Promise<T[]> {
    this.masterDataReads++
    return clone((fixture.masterData[key] ?? []) as T[])
  }

  async getUserData<T> (key: string): Promise<T> {
    return clone(fixture.userData[key] as T)
  }

  async getMusicMeta (): Promise<MusicMeta[]> {
    return clone(fixture.musicMeta)
  }

  async getUserDataAll (): Promise<Record<string, any>> {
    return clone(fixture.userData)
  }
}

export const TEST_DATA_PROVIDER = new CachedDataProvider(new DeterministicDataProvider())
