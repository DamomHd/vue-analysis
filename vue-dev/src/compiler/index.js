/*
 * @Author: Damom
 * @Date: 2021-01-04 14:15:17
 * @LastEditors: Damom
 * @LastEditTime: 2021-01-07 17:58:15
 * @Description: 渲染编译核心内部流程
 */
/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 模板解析阶段 正则等方式解析template 中 指令 class style 等数据 形成AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化阶段 遍历AST 标记静态节点
    // patch过程中，DOM-diff算法跳过静态节点 减少比较过程 优化patch性能
    optimize(ast, options)
  }
  // 代码生成阶段 AST转为render函数
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
