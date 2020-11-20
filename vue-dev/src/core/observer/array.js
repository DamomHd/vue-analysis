/*
 * @Descripttion: Vincent
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-17 11:26:33
 * @LastEditors: vincent_Huanghd@126.com
 * @LastEditTime: 2020-11-17 17:41:34
 * @description: observer类通过重写array方法 创建数据方法拦截器 间接性达到监听拦截的作用
 */
/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'
//数组的prototype
const arrayProto = Array.prototype
//创建一个对象作为拦截器
export const arrayMethods = Object.create(arrayProto)
//改变数组自身内容的几个方法
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  //缓存原生的方法
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args) 
    const ob = this.__ob__  // 取得响应实例Observer this即数据value 这儿的用法同dependArray(value)，就是为了取得dep
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args   //参数为新增元素
        break
      case 'splice':
        inserted = args.slice(2)  //参数为下标2的即为新增元素
        break
    }
    //如果有新的数据插入 同时对新数据进行监听 转为响应式
    if (inserted) ob.observeArray(inserted)
    // notify change
    //依赖改变 发送通知 watcher类  依赖更新
    ob.dep.notify() 
    return result
  })
})
