/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-20 16:54:29
 * @LastEditTime: 2021-03-08 17:41:25
 * @description: initEvent 初始化事件中心 实际上是初始化父组件在模板中使用的v-on 或者@注册的监听子组件内触发的事件
 * 因为父组件给子组件的注册时间中，吧自定义事件传给了子组件，在子组件的实例化的时候才进行初始化。而浏览器原生事件是在父组件里处理的
 */
/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  // 获取父组件注册事件给listeners
  const listeners = vm.$options._parentListeners
  if (listeners) {
    //存在则调用 将父组件向子组件的注册事件注册到子组件的实例中
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}
/**
 * @description: 将父组件向子组件的注册事件注册到子组件的实例中
 * @param {*}
 * @return {*}
 * @Date: 2021-03-05 15:18:18
 */
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}
/**
 * @description: 依赖注入mixin
 * @param {*} Vue
 * @return {*}
 * @Date: 2021-03-08 17:08:41
 */
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

  /**
   * @description: 全局on方法 
   * @param {event} 订阅事件名
   * @return {fn} 回调函数
   * @Date: 2021-03-08 17:09:46
   */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 数组一次性订阅多个
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
        // 判断当前实例上是否有对应事件 无则赋空 再push进去回调函数
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }
  /**
   * @description: 监听一次自定义事件 执行完移除
   * @param {*}
   * @return {*}
   * @Date: 2021-03-08 17:41:10
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }
  /**
   * @description: 移除自定义事件监听
   * @param {*}
   * @return {*}
   * @Date: 2021-03-08 17:22:19
   */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all 移除所有事件 
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events 一次性移除所有事件。 循环关闭订阅
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event]
    // 无订阅此事件 直接返回
    if (!cbs) {
      return vm
    }
    // 无回调函数移除所有监听器
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // specific handler 传入了事件名 和 回调  cbs且存在
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 所有的回调函数
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
