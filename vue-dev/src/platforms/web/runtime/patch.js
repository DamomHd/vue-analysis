/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-17 11:26:33
 * @LastEditTime: 2020-11-19 18:16:24
 * @description: 
 */
/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)
//patch函数指向了createPatchFunction    nodeOps:封装了一系列操作DOM的函数     modules:定义一些模块的钩子函数实现
export const patch: Function = createPatchFunction({ nodeOps, modules })
