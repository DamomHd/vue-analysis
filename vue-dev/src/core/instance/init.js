/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
/**
 * @description: new Vue()后执行的函数
 * @param {*} Vue
 * @return {*}
 */
export function initMixin (Vue: Class<Component>) {
  /* new Vue 源头的开始 */ 
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this   //vm指向this  =》 Vue
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // _isComponent为true表示为一个组件
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      //
      initInternalComponent(vm, options)
    } else {
      //合并配置
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)  //初始化生命周期
    initEvents(vm)  //初始化事件中心
    initRender(vm) //渲染逻辑 rander
    callHook(vm, 'beforeCreate') // 调用生命周期钩子函数
    initInjections(vm) // 初始化injections  resolve injections before data/props   
    initState(vm) // 初始化props methods data computed watch
    initProvide(vm) //初始化provide resolve provide after data/props
    callHook(vm, 'created') // 调用生命周期钩子函数

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果有el属性，调用$mount 挂载vm  =》模板渲染成最终DOM
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
//把之前通过 createComponentInstanceForVnode 函数传入的几个参数合并到内部的选项 $options 里了
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)  // =》vm.$options = Object.create(Sub.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode

  opts.parent = options.parent  //赋值子组件的Vue实例parent
  opts._parentVnode = parentVnode  //赋值子组件的父VNode实例

  const vnodeComponentOptions = parentVnode.componentOptions
  //保留parentVNode配置中的propsData等属性
  opts.propsData = vnodeComponentOptions.propsData  
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
