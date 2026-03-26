export interface User {
  userRegistration: {
    userId: number
    signature: string
    platform: string
    deviceModel: string
    operatingSystem: string
    yearOfBirth: number
    monthOfBirth: number
    dayOfBirth: number
    age: number
    billableLimitAgeType: string
    registeredAt: number
  }
  userGamedata: {
    userId: number
    name: string
    deck: number
    customProfileId: number
    rank: number
    exp: number
    totalExp: number
    coin: number
    virtualCoin: number
    lastLoginAt: number
    chargedCurrency: {
      paid: number
      free: number
      paidUnitPrices: Array<{
        remaining: number
        unitPrice: number
      }>
    }
    boost: {
      current: number
      recoveryAt: number
    }
  }
}
