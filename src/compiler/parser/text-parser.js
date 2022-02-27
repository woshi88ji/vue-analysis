/* @flow */

import { cached } from "shared/util";
import { parseFilters } from "./filter-parser";

const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g;
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;

const buildRegex = cached((delimiters) => {
  const open = delimiters[0].replace(regexEscapeRE, "\\$&");
  const close = delimiters[1].replace(regexEscapeRE, "\\$&");
  return new RegExp(open + "((?:.|\\n)+?)" + close, "g");
});

type TextParseResult = {
  expression: string,
  tokens: Array<string | { "@binding": string }>,
};

// 解析文本，
export function parseText(
  text: string,
  delimiters?: [string, string]
): TextParseResult | void {
  // 根据有无配置选项确定好插入替换符的匹配正则
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;
  // 正则校验不通过，说明没有插入替换符，只是普通的文本，直接返回
  if (!tagRE.test(text)) {
    return;
  }
  //
  const tokens = [];
  const rawTokens = [];
  // reg.lastIndex 用来指定下一次匹配的起始索引，在设置 g 时有效
  let lastIndex = (tagRE.lastIndex = 0);
  let match, index, tokenValue;
  // 循环正则匹配的结果数组
  // 每次调用exec方法，都会返回一个新匹配到的结果数组，当匹配不到时，返回null，退出while循环
  while ((match = tagRE.exec(text))) {
    // index属性表示匹配到的字符在text中的索引
    index = match.index;
    // push text token
    if (index > lastIndex) {
      // 分隔符前还有普通字符
      // 将普通字符存入rawTokens中
      rawTokens.push((tokenValue = text.slice(lastIndex, index)));
      // 序列化后的字符存入tokens中
      tokens.push(JSON.stringify(tokenValue));
    }
    // tag token
    const exp = parseFilters(match[1].trim());
    tokens.push(`_s(${exp})`);
    rawTokens.push({ "@binding": exp });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    rawTokens.push((tokenValue = text.slice(lastIndex)));
    tokens.push(JSON.stringify(tokenValue));
  }
  return {
    expression: tokens.join("+"),
    tokens: rawTokens,
  };
}
