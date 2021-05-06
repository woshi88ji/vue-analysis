/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})
// 缓存原来的 $mount 方法
const mount = Vue.prototype.$mount
// 给Vue添加新的 $mount 方法
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 获取要挂载的元素节点
  el = el && query(el)

  /* istanbul ignore if */
  // 不能挂载到 body 和 html 节点上
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }
  const options = this.$options
  // resolve template/el and convert to render function
  // 如果没有render函数，则会把 el 或者template转化成render函数
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        // 如果template是字符串，且以 # 开头，说明传入的是一个id，获取该id的节点
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // 如果是原生节点，则返回该节点所包含的内容节点
        template = template.innerHTML
      } else {
        // 抛出error
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 如果没有template属性，则返回dom节点
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      // 调用performance打点时间戳
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }
      // 将template编译成render函数
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      // 编译完成，打点结束时间，计算编译所花费的时间
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 一些节点，比如文本节点是没有outHTML属性的，为了能够拿到当前节点的html代码，可以创建一个div，然后将其整体append进去，然后就可以通过div的innerHtml属性获取到该节点信息了
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
