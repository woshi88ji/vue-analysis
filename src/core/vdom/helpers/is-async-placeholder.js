/* @flow */
// 判断是否是异步组件
export function isAsyncPlaceholder(node: VNode): boolean {
  return node.isComment && node.asyncFactory
}
