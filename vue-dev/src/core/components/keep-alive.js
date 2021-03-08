/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
/**
 * @description: 更新缓存include exclude规则
 * @param {*} keepAliveInstance
 * @param {*} filter
 * @return {*}
 */
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance

  // 遍历
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      // 将不需要缓存的组件先销毁
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}
/**
 * @description: 移除不需要缓存的组件实例 
 * @param {*}
 * @return {*}
 */
function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  if (cached && (!current || cached.tag !== current.tag)) {
    //销毁组件
    cached.componentInstance.$destroy()
  }
  //从cache中移除
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created () {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed () {
    // 遍历被缓存且没被 渲染的组件销毁并从cache中移除
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    // 观测 include 和 exclude变化  执行pruneCache 更新规则
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render () {
    // 获取默认插槽中第一个组件点
    const slot = this.$slots.default
    const vnode: VNode = getFirstComponentChild(slot)
    // 获取组件节点的componentOptions
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      // 获取组件名
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      // 即不存在于include 也不存在于exclude 直接返回vnode
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key

      // 命中缓存 直接从缓存拿到vnode组件实例  
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 先删除key 再推进缓存列表 保证其激活顺序
        remove(keys, key)
        keys.push(key)
      }
      // 未命中 设置进缓存 
      else {
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        // 如果配置了max并且缓存长度超过 从缓存中清掉第一个
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      // 最后设置keepalive标记
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
