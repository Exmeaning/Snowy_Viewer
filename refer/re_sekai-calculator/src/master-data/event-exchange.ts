export interface EventExchange {
  id: number
  resourceBoxId: number
  exchangeLimit: number
  eventExchangeCost: {
    id: number
    eventExchangeId: number
    resourceType: string
    resourceId: number
    resourceQuantity: number
  }
}
