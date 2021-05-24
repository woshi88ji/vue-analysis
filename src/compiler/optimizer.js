/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag
/**
 * 利用闭包，缓存校验函数要校验的key
 */
const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
// 优化ast树，对静态节点进行标记
export function optimize(root: ?ASTElement, options: CompilerOptions) {
  // 没有根节点，直接返回
  if (!root) return
  // 生成一个校验函数，接收一个字符串，返回一个布尔值，用于校验静态节点的key是否符合要求
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  // 校验函数，用于校验标签是否是html原生标签或者是svg
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}
/**
 * 将传入的字符串拼接，生成一个校验函数。后续用于校验静态节点的所有key是否包含在该字符串中
 * @param {string} 校验文本 
 * @returns {Function} 返回一个校验函数
 */

function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
    (keys ? ',' + keys : '')
  )
}
// 递归标记节点是否为静态节点
function markStatic(node: ASTNode) {
  // 标记节点是否为静态节点
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    // 如果不是html原生标签，同时也不是slot内容，也不是内联template
    // 说明是该节点为组件节点，则必为非静态节点
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    // 如果子节点为非静态节点，则父节点也为非静态节点
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    // 如果元素有v-if或者v-else条件属性，则说明该节点为非静态节点
    if (node.ifConditions) {
      // type nodeType = { exe: string; block: ASTNode }
      // ifConditions: nodeType[] 属性存放的是同一组的条件属性绑定的节点，exe属性表示条件属性绑定的值， v-else 的exe属性为 underfunded
      // ifConditions[0] 存放的是节点本身，如果length大于1，说明该组条件元素有多个，从第二个开始递归标记静态节点
      // eg: ifConditions = [v-if-node, ...v-else-if-node, v-else-node]
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}
// 标记静态根节点。我理解为 如果一个节点及其所有子节点都是静态节点，则该节点为静态根节点
function markStaticRoots(node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    // 如果节点为静态节点，说明该节点不是v-for循环的静态节点
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 1. 节点为静态节点 2. 包含子节点 3. 子节点不是唯一的文本节点  --同时满足所有条件的是静态根节点
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    // 递归标记
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    // 对于v-if条件组的从第二位开始遍历递归
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}
// 判断是否是静态节点
function isStatic(node: ASTNode): boolean {
  // node.type为2时，表示该节点是一个表达式，非静态
  if (node.type === 2) { // expression
    return false
  }
  // node.type为3时，表示该节点是一个文本节点，是静态
  if (node.type === 3) { // text
    return true
  }
  // 如果v-pre属性为true，说明是静态资源
  // 
  return !!(node.pre || (
    !node.hasBindings && // 没有动态绑定的属性
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // 不是内置的slot和component组件
    isPlatformReservedTag(node.tag) && // 是平台保留的标签，也就是原生html标签
    !isDirectChildOfTemplateFor(node) && // 不是v-for的template元素的直接子元素
    Object.keys(node).every(isStaticKey) // node上只有type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap, staticClass, staticStyle这13个属性
  ))
}
// 判断是否是v-for的 template 元素的直接子元素
function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
