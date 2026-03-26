import { TestDataProvider } from './data-provider.test'
import {
  CardEventCalculator,
  DeckService,
  EventCalculator,
  EventType,
  LiveType
} from '../src'

const eventCalculator = new EventCalculator(TestDataProvider.INSTANCE)
const cardEventCalculator = new CardEventCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)
// 选一张卡算加成，25+25
test('card', async () => {
  await cardEventCalculator.getCardEventBonus(await deckService.getUserCard(510), 88).then(it => {
    expect(it).toBe(50)
  })
})

// 选一个卡组算加成，按mock的数据应该是287.5%加成
test('deck', async () => {
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await eventCalculator.getDeckEventBonus(deck, 88).then(it => {
    expect(it).toBe(240)
  })
})

test('challenge point', () => {
  const point = EventCalculator.getEventPoint(LiveType.CHALLENGE, EventType.NONE, 1919810)
  expect(point).toBe(23400)
})

test('multi point', () => {
  expect(EventCalculator.getEventPoint(
    LiveType.MULTI, EventType.MARATHON, 2499999, 100, 260, 15, 8888888)).toBe(14580)
  expect(EventCalculator.getEventPoint(
    LiveType.MULTI, EventType.MARATHON, 1907777, 100, 125, 15, 8888888)).toBe(7920)
  expect(EventCalculator.getEventPoint(
    LiveType.MULTI, EventType.MARATHON, 2302222, 100, 315, 10, 8888888)).toBe(10700)
  expect(EventCalculator.getEventPoint(
    LiveType.MULTI, EventType.MARATHON, 2070000, 100, 285, 23, 8888888)).toBe(21597)
  expect(EventCalculator.getEventPoint(
    LiveType.MULTI, EventType.MARATHON, 2061111, 100, 271, 10, 8888888)).toBe(9050)
})

test('cheerful point', () => {
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 2358888, 113, 361, 10, 8888888)).toBe(18340)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 2384444, 113, 361, 5, 8888888)).toBe(9245)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 2397777, 111, 361, 15, 8888888)).toBe(27330)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 2469999, 108, 361, 15, 8888888)).toBe(27000)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 3113333, 111, 270, 1, 8888888, 920)).toBe(1675)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 1927777, 120, 361, 1, 3699999, 920)).toBe(1718)
  expect(EventCalculator.getEventPoint(
    LiveType.CHEERFUL, EventType.CHEERFUL, 3213333, 108, 270, 1, 8888888)).toBe(1682)
})
