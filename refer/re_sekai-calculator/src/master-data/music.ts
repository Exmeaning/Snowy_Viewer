export interface Music {
  id: number
  seq: number
  releaseConditionId: number
  categories: string[]
  title: string
  pronunciation: string
  creator: string
  lyricist: string
  composer: string
  arranger: string
  dancerCount: number
  selfDancerPosition: number
  assetbundleName: string
  liveTalkBackgroundAssetbundleName: string
  publishedAt: number
  liveStageId: number
  fillerSec: number
}
