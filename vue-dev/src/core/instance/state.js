/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
/**
 * @description: 初始化data props computed watcher 等
 * @param {*} vm
 * @return {*}
 */
export function initState (vm: Component) {
  vm._watchers = [] //用于存储当前实例的所有watcher实例
  const opts = vm.$options
  //初始化props
  if (opts.props) initProps(vm, opts.props)
  //初始化methods
  if (opts.methods) initMethods(vm, opts.methods)
  //初始化data
  if (opts.data) {
    initData(vm)
  } else {
    //根元素
    observe(vm._data = {}, true /* asRootData */)
  }
  //初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  //初始化watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
// 初始化props
function initProps (vm: Component, propsOptions: Object) {
  // 父组件传入的真实props
  const propsData = vm.$options.propsData || {}
  // 指向vm._props 所有设置props的属性都会保存在此
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 用于缓存props对象中的key 将来更新props遍历_propKeys即可得到所有props的key
  const keys = vm.$options._propKeys = []
  // 是否根组件
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    //非根组件 不需要转为响应式
    toggleObserving(false)
  }
  //遍历所有props
  for (const key in propsOptions) {
    keys.push(key) //添加到keys
    //validateProp 校验传入props类型是否匹配并获取传入的值 
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      //添加到vm._props即props
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // key在vm中不存在 调用proxy在vm上设置以key为属性
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
// 初始化data
function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  //无论是对象 还是函数的返回值 均结果为对象才可
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // 属性名冲突
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // props已存在 提示
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } 
    //将key不以$ _开头的属性绑定到实例vm
    else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 将data转为响应式
  observe(data, true /* asRootData */)
}
// 获取data
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化computed 计算属性
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key] //每项的值
    // 判断如果是函数 则默认为取值器getter ，如果不是为对象 取其get函数
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 取不到getter报错
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    //非SSR
    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建一个watcher 属性名作为key存入watchers对象中
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    //当前循环属性名不在vm中 调用defineComputed为vm设置计算属性
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      //computed属性名在data、props中出现 警告已存在
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
/**
 * @description: 设置计算属性
 * @param {*}
 * @return {*}
 */
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() //标识是否有缓存（非SSR则为true）
  // userDef是个函数 
  if (typeof userDef === 'function') {
    //调用createComputedGetter创建一个get
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    //调用createComputedGetter创建一个get
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  // 开发环境用户没设置setter则设置默认函数  防止用户在没设置setter情况下修改计算属性 抛出警告
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
/**
 * @description: 创建
 * @param {*} key
 * @return {*}
 */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 具有缓存功能 执行evaluate 
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

// 初始化methods 
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props //获取props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      //方法未定义
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      //与props中变量名冲突
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      //在vm从存在并且方法名是_或者$开头，抛异常命名不规范
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化watch 
function initWatch (vm: Component, watch: Object) {
  // 遍历watch选项 拿到每项 key handler 再判断hanler是否为数组 
  // 数组则循环调用createWatcher创建watcher
  // 非数组直接调用一次createWatcher创建watcher
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建watch监听类
/**
 * @description: 创建watcher
 * @param {*}
 * @return {*}
 */
function createWatcher (
  vm: Component,
  expOrFn: string | Function, // 被监听的属性表达式
  handler: any, // watch选项中每项的值
  options?: Object // 传递vm.$watch的选项对象
) {
  //判断用户的多种watch用法 获取handler
  // 用法1 a:{handler:function(){},deep:true}
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 用法2  a:'handler2'
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 用法3 a:function(){} 非以上两种 则直接使用无需处理
  // 返回初始化号的watch
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
