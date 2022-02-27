/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'
// 因为一些属性在用 innerHTML 获取时，一些特殊字符会被转成unicode编码，这里将其转换回来
function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML(html, options) {
  // 初始化stack，用于维护非自闭合的元素栈
  const stack = []
  const expectHTML = options.expectHTML
  // 用 于判断是否是自闭合标签 
  const isUnaryTag = options.isUnaryTag || no
  // 可以只有左侧的开始标签，不需要右边再写一个闭合标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  // 在解析html时，解析完一部分html后，会将该部分html删除，直到html === ‘’时，说明解析完成
  // index 字段表示剩余 html 在完整html中的开始位置
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      // 先匹配 ’<’ , 会出现几种可能
      // 1. < 在首位，且正则校验为标签，解析标签
      // 2. 匹配到 <, 但正则校验不为标签

      // < 在首位，且是标签的处理
      if (textEnd === 0) {
        // 解析到<!-- 时，说明解析到了注释
        if (comment.test(html)) {
          // 注释的结束字符位置
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // shouldKeepComment 的值来源于$options.comments,
            // 默认为false，对于解析到的注释内容不展示
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 将解析完的字符串切割
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 解析到条件注释  <![if expression]> HTML <![endif]>
        // 这块不做任何处理，直接切割下来
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // <!doctype html>
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        // 解析到闭合标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        // 解析到开始标签，生成元素的一个简单实例对象，包括属性值，标签名，开始位置
        // 如果开始标签不完整， 比如 <div id= 'id  <div></div> , 不完整的标签会被忽略
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }
      // 匹配到 < , 但正则校验不为标签的处理
      let text, rest, next
      if (textEnd >= 0) {
        // 从 < 开始截取后面的字符串， 循环校验是否为标签
        rest = html.slice(textEnd)
        // 循环校验，如果不是结束标签，开始标签，注释标签和条件注释标签，说明该 < 字符只是一个普通字符，无特殊含义。继续匹配下一个 < 字符。
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          // 因为首位就是 < , 所以要从第一位开始匹配 <
          next = rest.indexOf('<', 1)
          // next 为 -1 时，说明字符串后面没有 < 字符了，退出while循环
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        // 如果在后面的字符中匹配到标签，则将标签前的的字符切除进行处理，如果没有，则返回整个字符
        text = html.substring(0, textEnd)
      }
      // 如果没有匹配到 < ,说明后面都只是普通的字符串
      if (textEnd < 0) {
        text = html
      }
      if (text) {
        // 切除相应的字符串
        advance(text.length)
      }
      // index 字段保存的是剩余html在完整html的开始位置。
      // 在上面165行，已经将text的字符切除了，所以 index-text.length表示的是text在html中的开始位置
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  // 切割字符串
  function advance(n) {
    index += n
    html = html.substring(n)
  }
  // 解析开始标签， 以 ‘<’ 开始，解析出标签的名称和属性， 以‘>’ 结尾
  function parseStartTag() {
    // 解析得到标签名称
    // 解析得到的为一个数组 eg：['<div', 'div']
    const start = html.match(startTagOpen)
    if (start) {
      // 创建该标签的实例对象
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      // 切除带标签名称那部分字符
      advance(start[0].length)
      let end, attr
      // while 循环解析标签的属性
      // while条件包括两部分，前面是标签是否结束了 “>” ,后面则为解析得到属性值
      // 以 id=’app' 为例，得到的属性值为 [' id="app"', 'id=', '=', 'app', undefined, undefined]
      // 
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        // 属性每次只会解析一个
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      // 如果解析到 ‘>’ 或者 ‘/>’, 说明这个标签解析完成了，
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }
  // 对解析好的标签对象进行处理
  function handleStartTag(match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      // 如果上一级标签是p标签，且这一次解析到块级元素，因为p标签不能包含块级元素。vue的做法是将p标签闭合，后续包含的标签与p标签同级展示，
      // 最后面的</p>再生成一个一个空的p元素
      //  eg：<p><span>111</span><div>我是div</div></p> ==> <p><span>111</span></p><div>我是div</div><p></p>
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      // 部分标签是在特定情况下，是可以省略结束标签的，如 <li>张三</li><li>李四</li> 可以写成 <li>张三<li>李四
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }
    // 判断是否是自闭合标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      // 判断是否需要对ie的特殊情况
      // 在ie下，通过innerHTML获取template时。属性的 换行符都会被替换成 ‘&#10；’
      // 在chrome下，只有a标签的href会出现这种情况
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      // 记录属性的开始位置和结束位置
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) {
      // 如果不是自闭合标签，解析完开始标签后，将其推入 stack 栈中，便于在解析到其闭合标签时进行配对
      // 这里只是维护一份简单的数据对象，用于配对闭合标签
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    if (options.start) {
      // 将解析到的开始标签，通过函数调用，在外层维护一份详细的stack栈
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }
  // 处理结束标签
  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 从维护的stack栈中匹配离的最近的相同名称的元素实例对象
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }
    if (pos >= 0) {
      // 如果匹配到元素或者不传元素名称
      // Close all the open elements, up the stack
      // 该for循环的必要条件是 stack 栈中还剩余有未匹配的元素
      for (let i = stack.length - 1; i >= pos; i--) {
        // 两种情况下会提示标签没有闭合标签
        // 1、匹配的不是stack栈中的最后一个元素，比如stack有4个元素实例，匹配到的是第三个，则第四个元素会被认为没有闭合标签
        // 2、在解析的最后，会不传参的调用一次 parseEndTag 函数，如果一切正常，则不会进入该for循环
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        // 调用外层的 end 方法
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      // 处理完以后，将匹配到及其之后的实例都清除
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      // 如果解析到 </br> 会将其转成 <br>
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      // 如果解析到</p>,会补全标签，变成 <p></p>,然后调用 start和end方法进行处理
      // 这一般出现在在p标签中写了块级元素
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
