/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-20 16:54:29
 * @LastEditTime: 2021-03-08 18:27:25
 * @description: 
 */
/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  /**
   * @description: 注册 component direactive
   * @param {*}
   * @return {*}
   * @Date: 2021-03-08 18:20:03
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      // false为获取 true为注册 filter无需操作 直接赋值即可
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        // 注册在开发环境校验name的合法性
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 最终保存在options里的directives
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
