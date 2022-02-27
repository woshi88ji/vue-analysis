/* @flow */

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
let div
function getShouldDecode(href: boolean): boolean {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  return div.innerHTML.indexOf('&#10;') > 0
}

// #3663: IE encodes newlines inside attribute values while other browsers don't
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828: chrome encodes content in a[href]
export const shouldDecodeNewlinesForHref = inBrowser ? getShouldDecode(true) : false
// 在网上找到了这块的相关解释
// 在我们innerHTML获取内容时，换行符和制表符分别被转换成了&#10和&#9。在IE中，不仅仅是 a 标签的 href 属性值，任何属性值都存在这个问题。
// 这就会影响Vue的编译器在对模板进行编译后的结果，为了避免这些问题Vue需要知道什么时候要做兼容工作，如果 shouldDecodeNewlines 为 true，意味着 Vue 在编译模板的时候，要对属性值中的换行符或制表符做兼容处理。而shouldDecodeNewlinesForHref为true 意味着Vue在编译模板的时候，要对a标签的 href 属性值中的换行符或制表符做兼容处理。

// 但我本地测试的时候，在ie下没法复现出这个现象，不知道是哪里弄错了