/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile(
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 将template转成ast，
  const ast = parse(template.trim(), options)
  // 优化ast，对于一些静态节点，进行标记，在更新的时候跳过这些节点，提高效率
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 将优化过后的ast树转成可执行的代码
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
