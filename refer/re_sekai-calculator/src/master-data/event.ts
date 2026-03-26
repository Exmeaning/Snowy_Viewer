export interface Event {
  id: number
  eventType: string
  name: string
  assetbundleName: string
  bgmAssetbundleName: string
  startAt: any
  aggregateAt: any
  rankingAnnounceAt: any
  distributionStartAt: any
  closedAt: any
  distributionEndAt: any
  virtualLiveId: number
  eventRankingRewardRanges: Array<{
    id: number
    eventId: number
    fromRank: number
    toRank: number
    eventRankingRewards: Array<{
      id: number
      eventRankingRewardRangeId: number
      resourceBoxId: number
    }>
  }>
}
