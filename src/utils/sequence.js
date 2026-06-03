/**
 * 单调递增序号 token，用于防止"快速切换条件时旧请求覆盖新数据"的竞态。
 *
 * 使用方法（fire & forget）：
 *   const seq = createSequence()
 *   async function loadList() {
 *     const my = seq.next()
 *     const data = await api.fetch()
 *     if (!seq.isCurrent(my)) return    // 已被更新的请求取代，丢弃本次结果
 *     state.value = data
 *   }
 *
 * 也可以用 invalidate() 在组件卸载或 dialog 关闭时让所有 in-flight 请求作废。
 */
export function createSequence(initial = 0) {
  let counter = initial
  return {
    next() {
      counter += 1
      return counter
    },
    current() {
      return counter
    },
    isCurrent(token) {
      return token === counter
    },
    invalidate() {
      counter += 1
    },
  }
}
