控分组卡 (EventBonusDeckRecommend) 使用指南
新增的 
EventBonusDeckRecommend
 类专门用于控分场景。与常规按最高 PT 推荐不同，它会寻找活动加成（Event Bonus）数值恰好等于目标值的卡组。

核心用法
你需要实例化 
EventBonusDeckRecommend
 并调用 
recommendEventBonusDeck
 方法。

代码示例
typescript
import { EventBonusDeckRecommend, LiveType, TestDataProvider } from 'sekai-calculator'
const recommend = new EventBonusDeckRecommend(dataProvider)
// 目标：寻找活动加成恰好为 250% 的卡组
const targetBonus = 250
const eventId = 89 // 当前活动 ID
const result = await recommend.recommendEventBonusDeck(
  eventId, 
  targetBonus, 
  LiveType.MULTI, 
  {
    musicMeta: myMusicMeta, // 必须提供，虽然重点是加成，但仍保留了基础结构
    member: 5,               // 默认推荐 5 人队伍
    debugLog: (msg) => console.log(msg) // 可选：查看搜索进度
  }
)
if (result.length > 0) {
  const deck = result[0]
  console.log('找到匹配卡组！')
  console.log('总加成:', (deck.eventBonus || 0) + (deck.supportDeckBonus || 0))
  console.log('卡牌 ID 列表:', deck.cards.map(c => c.cardId))
} else {
  console.log('未找到加成完全匹配的卡组。')
}
参数说明
recommendEventBonusDeck
参数	类型	说明
eventId	number	目标活动的 ID。
targetBonus	number	核心参数。你期望的最终总加成百分比（如 250 代表 +250%）。
liveType	LiveType	Live 类型（SOLO, MULTI, CHEERFUL 等）。
config	
Config
包含 musicMeta (必选), member (可选), cardConfig (可选) 等。
specialCharacterId	number	可选。World Link 活动中指定的支援角色 ID。
特点与限制
精准匹配：该方法只返回活动加成完全等于 targetBonus 的结果。如果最高加成都达不到目标，或者排列组合中没有刚好等于该值的，将返回空数组 []。
唯一输出：根据你的要求，该方法在找到第一个满足条件的卡组后就会停止算法并返回（如果有多个满足条件的卡组，只返回其中一个）。
已选卡牌：推荐算法会自动考虑你拥有的所有卡牌（通过 dataProvider 获取），并排除重复角色。
性能优化：内部使用了带剪枝的 DFS 搜索，会自动跳过已超过目标加成的组合路径。
TIP

如果你需要推荐"最接近但超过"或"尽可能高"的卡组，请继续使用原有的 
EventDeckRecommend
。本工具仅用于需要数值完全准确的控分场景。