/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-20 16:54:29
 * @LastEditTime: 2021-03-05 17:21:03
 * @description: 
 */
/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * @description: 初始化provide
 * @param {*} vm
 * @return {*}
 * @Date: 2021-03-05 17:02:58
 */
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}
/**
 * @description: 初始化inject
 * @param {*} vm
 * @return {*}
 * @Date: 2021-03-05 17:03:07
 */
export function initInjections (vm: Component) {
    // 将inject选项数据转化为键值对形式赋值
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false) // 仅仅添加到当前实例而不需要转为响应式 对应官文中 =》  provide 和 inject 绑定并不是可响应的
    // 遍历键值对将其添加到当前实例
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        //添加到实例
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}
/**
 * @description: 将inject选项数据转化为键值对形式赋值 | 不断向上游查找数据key 如果至顶仍未找到并且未设置默认值 则抛出异常
 * @param {*} inject
 * @param {*} vm
 * @return {*}
 * @Date: 2021-03-05 17:12:11
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm
      while (source) {
        //如果当前实例有provided选项并且包含inject里from的key  对inject值进行赋值
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        //向上赋值 直至根父组件
        source = source.$parent
      }
      //如果至没有实例情况下 查看当前inject是否设置了default默认值
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          // 默认值如果是函数 取其返回值 否则取其本身
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 未设置 抛出异常
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
