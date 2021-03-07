/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-17 11:26:33
 * @LastEditTime: 2021-02-28 18:13:40
 * @description: 
 */
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
//Vue  Function实现的类  通过new Vue去实现 
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue) //初始化Mixin 给原型绑定_init方法
stateMixin(Vue) 
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
