/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
// 处理指令逻辑 在create update destroy三个阶段进行处理指令逻辑
export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}
/**
 * @description: 新旧有一方涉及指令即调用update处理指令逻辑
 * @param {*} oldVnode
 * @param {*} vnode
 * @return {*}
 */
function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

function _update (oldVnode, vnode) {
  const isCreate = oldVnode === emptyNode  //判断旧节点是否是个空的 是则说明是个新的节点
  const isDestroy = vnode === emptyNode  // 判断当前节点是否为空节点 是则标识当前节点对应旧节点被销毁
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)  // 旧指令集合
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)  // 新指令集合

  const dirsWithInsert = []  // 需要触发insert的指令列表
  const dirsWithPostpatch = []  // 需要触发componentUpdated指令列表

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    // 不存在 则说明是首次绑定的新指令 则触发bind钩子
    if (!oldDir) {
      // new directive, bind
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        // 添加到钩子列表
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      // 存在触发update钩子
      dir.oldValue = oldDir.value
      dir.oldArg = oldDir.arg
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        // 添加到更新列表
        dirsWithPostpatch.push(dir)
      }
    }
  }
  // 循环调用inserted钩子  在被绑定元素插入到父节点时调用
  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    // 新节点 触发DOM渲染insert和指令inserted钩子
    if (isCreate) {
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      // 旧节点 触发inserted钩子
      callInsert()
    }
  }
  //vnode更新完执行componentUpdated钩子
  if (dirsWithPostpatch.length) {
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
