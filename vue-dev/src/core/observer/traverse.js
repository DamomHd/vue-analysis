/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-20 16:54:29
 * @LastEditTime: 2021-03-08 15:44:15
 * @description: 
 */
/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}
/**
 * @description: 深度依赖侦听
 * @param {*} val
 * @param {*} seen  集合数据
 * @return {*}
 * @Date: 2021-03-08 15:41:05
 */
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id  // 深度监听的id 避免重复收集依赖
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  // 如果是个数组 循环遍历监听
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    // 对象 遍历对象内部进行监听
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
