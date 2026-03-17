/**
 * 用于记录在不同的组合、属性情况下的值
 * 每种不同的值存储逻辑不同，有单独实现类
 */
export class CardDetailMap<T> {
  private min = Number.MAX_SAFE_INTEGER
  private max = Number.MIN_SAFE_INTEGER
  private readonly values = new Map<string, T>()

  /**
   * 设定给定情况下的值
   * 为了减少内存消耗，人数并非在所有情况下均为实际值，可能会用1代表混组或无影响
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）；任意情况：any；新FES原创觉醒前（异组）：diff
   * @param unitMember 该组合对应的人数（用于受组合影响的技能时：组分1～5、异组1～2；其他情况：5人为同组、1人为混组或无影响）
   * @param attrMember 卡牌属性对应的人数（5人为同色、1人为混色或无影响）
   * @param cmpValue 用于设置最小值、最大值的可比较值
   * @param value 设定的值
   */
  protected set (unit: string, unitMember: number, attrMember: number, cmpValue: number, value: T): void {
    this.updateMinMax(cmpValue)
    this.values.set(CardDetailMap.getKey(unit, unitMember, attrMember), value)
  }

  /**
   * 公开版本的 set，供外部组合使用
   */
  public setPublic (unit: string, unitMember: number, attrMember: number, cmpValue: number, value: T): void {
    this.set(unit, unitMember, attrMember, cmpValue, value)
  }

  /**
   * 更新最大最小值（不在values中存储值本身）
   * @param cmpValue 用于比较的值
   */
  protected updateMinMax (cmpValue: number): void {
    this.min = Math.min(this.min, cmpValue)
    this.max = Math.max(this.max, cmpValue)
  }

  public getInternal (unit: string, unitMember: number, attrMember: number): T | undefined {
    return this.values.get(CardDetailMap.getKey(unit, unitMember, attrMember))
  }

  /**
   * 实际用于Map的key，用于内部调用避免创建对象的开销
   * @param unit 组合
   * @param unitMember 组合人数
   * @param attrMember 属性人数
   * @private
   */
  protected static getKey (unit: string, unitMember: number, attrMember: number): string {
    return `${unit}-${unitMember}-${attrMember}`
  }

  /**
   * 是否肯定比另一个范围小
   * 如果几个维度都比其他小，这张卡可以在自动组卡时舍去
   * @param another 另一个范围
   */
  /**
   * 获取所有情况下的最大可比较值
   */
  public getMax (): number {
    return this.max
  }

  /**
   * 获取所有情况下的最小可比较值
   */
  public getMin (): number {
    return this.min
  }

  public isCertainlyLessThen (another: CardDetailMap<T>): boolean {
    // 如果自己最大值比别人最小值还要小，说明自己肯定小
    return this.max < another.min
  }
}
