/*
 * @Descripttion: Damom
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-17 11:26:33
 * @LastEditTime: 2021-01-07 17:34:06
 * @description: DOM-Diff算法 patch
 */

/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode, { cloneVNode } from "./vnode";
import config from "../config";
import { SSR_ATTR } from "shared/constants";
import { registerRef } from "./modules/ref";
import { traverse } from "../observer/traverse";
import { activeInstance } from "../instance/lifecycle";
import { isTextInputType } from "web/util/element";

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  makeMap,
  isRegExp,
  isPrimitive,
} from "../util/index";

export const emptyNode = new VNode("", {}, []);

const hooks = ["create", "activate", "update", "remove", "destroy"];
/**
 * @description: 判断是否同一个虚拟节点
 * @param {*} a old VNode
 * @param {*} b new VNode
 * @return {*} Boolean
 */
function sameVnode(a, b) {
  return (
    a.key === b.key &&
    ((a.tag === b.tag &&
      a.isComment === b.isComment &&
      isDef(a.data) === isDef(b.data) &&
      sameInputType(a, b)) ||
      (isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)))
  ); 
}

function sameInputType(a, b) {
  if (a.tag !== "input") return true;
  let i;
  //每次判斷條件時又將i進行重新賦值 以便後續的判斷繼續成立
  const typeA = isDef((i = a.data)) && isDef((i = i.attrs)) && i.type;
  const typeB = isDef((i = b.data)) && isDef((i = i.attrs)) && i.type;
  return typeA === typeB || (isTextInputType(typeA) && isTextInputType(typeB));
}
//创建旧节点的索引对象
function createKeyToOldIdx(children, beginIdx, endIdx) {
  let i, key;
  const map = {};
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) map[key] = i;
  }
  return map;
}
//创建虚拟dom入口函数
export function createPatchFunction(backend) {
  let i, j;
  const cbs = {};

  const { modules, nodeOps } = backend;

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]]);
      }
    }
  }
  // oldVnode转换成Vnode对象
  function emptyNodeAt(elm) {
    return new VNode(
      nodeOps.tagName(elm).toLowerCase(),
      {},
      [],
      undefined,
      elm
    );
  }

  function createRmCb(childElm, listeners) {
    function remove() {
      if (--remove.listeners === 0) {
        removeNode(childElm);
      }
    }
    remove.listeners = listeners;
    return remove;
  }
  /**
   * @description: 删除节点
   * @param {*}
   * @return {*}
   */  
  function removeNode(el) {
    const parent = nodeOps.parentNode(el); //获取父节点
    // element may have already been removed due to v-html / v-text
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el); //通过父节点DOM的removeChild删除
    }
  }
  //判断是否是未知元素
  function isUnknownElement(vnode, inVPre) {
    return (
      !inVPre &&
      !vnode.ns &&
      !(
        config.ignoredElements.length &&
        config.ignoredElements.some((ignore) => {
          return isRegExp(ignore)
            ? ignore.test(vnode.tag)
            : ignore === vnode.tag;
        })
      ) &&
      config.isUnknownElement(vnode.tag)
    );
  }

  let creatingElmInVPre = 0;
  /**
   * @description: 创建真实Dom元素 通过虚拟节点创建真实DOM 插入父节点
   * @param {*}
   * @return {*}
   */
  function createElm(
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // This vnode was used in a previous render!
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    vnode.isRootInsert = !nested; // for transition enter check
    //创建组件
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return;
    }

    const data = vnode.data;
    const children = vnode.children;
    const tag = vnode.tag;
    //1.创建元素节点
    if (isDef(tag)) {
      if (process.env.NODE_ENV !== "production") {
        if (data && data.pre) {
          creatingElmInVPre++;
        }
        if (isUnknownElement(vnode, creatingElmInVPre)) {
          warn(
            "Unknown custom element: <" +
              tag +
              "> - did you " +
              "register the component correctly? For recursive components, " +
              'make sure to provide the "name" option.',
            vnode.context
          );
        }
      }
      //
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode);
      setScope(vnode);

      /* istanbul ignore if */
      //如果是weex环境
      if (__WEEX__) {
        // in Weex, the default insertion order is parent-first.
        // List items can be optimized to use children-first insertion
        // with append="tree".
        const appendAsTree = isDef(data) && isTrue(data.appendAsTree);
        if (!appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue);
          }
          insert(parentElm, vnode.elm, refElm);
        }
        createChildren(vnode, children, insertedVnodeQueue);
        if (appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue);
          }
          insert(parentElm, vnode.elm, refElm);
        }
      } else {
        //递归遍历创建元素节点子节点
        createChildren(vnode, children, insertedVnodeQueue);
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue);
        }
        //插入DOM中
        insert(parentElm, vnode.elm, refElm);
      }

      if (process.env.NODE_ENV !== "production" && data && data.pre) {
        creatingElmInVPre--;
      }
    } else if (isTrue(vnode.isComment)) {
      //2.创建注释节点
      vnode.elm = nodeOps.createComment(vnode.text);
      //插入DOM中
      insert(parentElm, vnode.elm, refElm);
    } else {
      //3.创建文本节点
      vnode.elm = nodeOps.createTextNode(vnode.text);
      //插入DOM中
      insert(parentElm, vnode.elm, refElm);
    }
  }
  //创建子组件
  function createComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data;
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive;
      if (isDef((i = i.hook)) && isDef((i = i.init))) {
        i(vnode, false /* hydrating */);
      }
      // after calling the init hook, if the vnode is a child component
      // it should've created a child instance and mounted it. the child
      // component also has set the placeholder vnode's elm.
      // in that case we can just return the element and be done.
      if (isDef(vnode.componentInstance)) {
        //初始化组件
        initComponent(vnode, insertedVnodeQueue);
        //insert操作DOM
        insert(parentElm, vnode.elm, refElm);
        if (isTrue(isReactivated)) {
          //重新激活组件
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm);
        }
        return true;
      }
    }
  }
  //初始化组件
  function initComponent(vnode, insertedVnodeQueue) {
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(
        insertedVnodeQueue,
        vnode.data.pendingInsert
      );
      vnode.data.pendingInsert = null;
    }
    vnode.elm = vnode.componentInstance.$el;
    if (isPatchable(vnode)) {
      invokeCreateHooks(vnode, insertedVnodeQueue);
      //为scoped CSS设置作用域ID属性
      setScope(vnode);
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      registerRef(vnode);
      // make sure to invoke the insert hook
      insertedVnodeQueue.push(vnode);
    }
  }

  function reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm) {
    let i;
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    let innerNode = vnode;
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode;
      if (isDef((i = innerNode.data)) && isDef((i = i.transition))) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode);
        }
        insertedVnodeQueue.push(innerNode);
        break;
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    insert(parentElm, vnode.elm, refElm);
  }
  //插入 父节点  vnode先子后父
  function insert(parent, elm, ref) {
    if (isDef(parent)) {
      if (isDef(ref)) {
        if (nodeOps.parentNode(ref) === parent) {
          nodeOps.insertBefore(parent, elm, ref);
        }
      } else {
        nodeOps.appendChild(parent, elm);
      }
    }
  }
  /**
   * @description: 创建元素的所有子节点
   * @param {*}
   * @return {*}
   */  
  
  function createChildren(vnode, children, insertedVnodeQueue) {
    //如果是数组  
    if (Array.isArray(children)) {
      if (process.env.NODE_ENV !== "production") {
        checkDuplicateKeys(children);
      }
      //递归创建元素
      for (let i = 0; i < children.length; ++i) {
        //遍历中把vnode.elm作为父容器的DOM节点占位符传入
        createElm(
          children[i],
          insertedVnodeQueue,
          vnode.elm,
          null,
          true,
          children,
          i
        );
      }
    }
    //子节点text有值 
    else if (isPrimitive(vnode.text)) {
      //真实DOM插入文本内容
      nodeOps.appendChild(
        vnode.elm,
        nodeOps.createTextNode(String(vnode.text)) //创建文本节点
      );
    }
  }
  
  function isPatchable(vnode) {
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode;
    }
    return isDef(vnode.tag);
  }
  // 执行所有的create钩子 并把vnode push到insertedVnodeQueue
  function invokeCreateHooks(vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) {
      cbs.create[i](emptyNode, vnode);
    }
    i = vnode.data.hook; // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) i.create(emptyNode, vnode);
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode);
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  //为scoped CSS设置作用域ID属性
  function setScope(vnode) {
    let i;
    if (isDef((i = vnode.fnScopeId))) {
      nodeOps.setStyleScope(vnode.elm, i);
    } else {
      let ancestor = vnode;
      while (ancestor) {
        if (isDef((i = ancestor.context)) && isDef((i = i.$options._scopeId))) {
          nodeOps.setStyleScope(vnode.elm, i);
        }
        ancestor = ancestor.parent;
      }
    }
    // for slot content they should also get the scopeId from the host instance.
    if (
      isDef((i = activeInstance)) &&
      i !== vnode.context &&
      i !== vnode.fnContext &&
      isDef((i = i.$options._scopeId))
    ) {
      nodeOps.setStyleScope(vnode.elm, i);
    }
  }
  //添加VNode节点
  function addVnodes(
    parentElm,
    refElm,
    vnodes,
    startIdx,
    endIdx,
    insertedVnodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(
        vnodes[startIdx],
        insertedVnodeQueue,
        parentElm,
        refElm,
        false,
        vnodes,
        startIdx
      );
    }
  }
  //销毁vnode钩子函数
  function invokeDestroyHook(vnode) {
    let i, j;
    const data = vnode.data;
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode);
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
    }
    //存在子节点 递归调用销毁其所有子节点
    if (isDef((i = vnode.children))) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j]);
      }
    }
  }
  //移除VNode节点
  function removeVnodes(vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      if (isDef(ch)) {
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch);
          invokeDestroyHook(ch);
        } else {
          // Text node
          removeNode(ch.elm);
        }
      }
    }
  }

  function removeAndInvokeRemoveHook(vnode, rm) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i;
      const listeners = cbs.remove.length + 1;
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        rm.listeners += listeners;
      } else {
        // directly removing
        rm = createRmCb(vnode.elm, listeners);
      }
      // recursively invoke hooks on child component root node
      if (
        isDef((i = vnode.componentInstance)) &&
        isDef((i = i._vnode)) &&
        isDef(i.data)
      ) {
        removeAndInvokeRemoveHook(i, rm);
      }
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm);
      }
      if (isDef((i = vnode.data.hook)) && isDef((i = i.remove))) {
        i(vnode, rm);
      } else {
        rm();
      }
    } else {
      removeNode(vnode.elm);
    }
  }


  /**
   * @description: 更新子节点
   * @param {*}
   * @return {*}
   */
  function updateChildren(
    parentElm,
    oldCh,
    newCh,
    insertedVnodeQueue,
    removeOnly
  ) {
    let oldStartIdx = 0; //旧节点当前开始索引
    let newStartIdx = 0; //新节点当前开始索引
    let oldEndIdx = oldCh.length - 1;  //旧节点最后一个结束索引
    let oldStartVnode = oldCh[0];  //旧节点第一个子节点
    let oldEndVnode = oldCh[oldEndIdx]; //旧节点最后一个子节点
    let newEndIdx = newCh.length - 1; //新节点最后一个结束索引
    let newStartVnode = newCh[0];  //新节点 第一个子节点
    let newEndVnode = newCh[newEndIdx];  //新节点 最后一个子节点
    let oldKeyToIdx, idxInOld, vnodeToMove, refElm;

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    //该标记仅在<transition-group>时实用
    //以确保被移除的元素保持在正确的相对位置
    const canMove = !removeOnly;  

    if (process.env.NODE_ENV !== "production") {
      checkDuplicateKeys(newCh);
    }

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      //如果当前oldChildren找不到当前循环的newChildren子节点
      if (isUndef(oldStartVnode)) {
        // 不存在直接跳过对比下一个
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        // 不存在直接跳过对比上一个
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 未处理 新旧节点第一个节点进行对比 
        patchVnode(
          oldStartVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        );
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        //未处理 新旧节点最后一个节点进行对比
        patchVnode(
          oldEndVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        );
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        // Vnode moved right
        // 新节点最后一个节点和旧节点第一个节点进行对比
        // 相同则更新 并将旧的该节点移动到新节点对应的数组位置上
        patchVnode(
          oldStartVnode,
          newEndVnode,
          insertedVnodeQueue,
          newCh,
          newEndIdx
        );
        canMove &&
          nodeOps.insertBefore(
            parentElm,
            oldStartVnode.elm,
            nodeOps.nextSibling(oldEndVnode.elm)
          );
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        // Vnode moved left
        // 新节点第一个节点和旧节点最后一个节点进行对比
        // 相同则更新 并将旧的该节点移动到新节点对应的数组位置上
        patchVnode(
          oldEndVnode,
          newStartVnode,
          insertedVnodeQueue,
          newCh,
          newStartIdx
        );
        canMove &&
          nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        //在以上的判断尝试均不符合的情况下 按照常规循环进行一一对比更新
        if (isUndef(oldKeyToIdx))
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
        //不存在旧节点 则重新创建元素
        if (isUndef(idxInOld)) {
          // New element
          createElm(
            newStartVnode,
            insertedVnodeQueue,
            parentElm,
            oldStartVnode.elm,
            false,
            newCh,
            newStartIdx
          );
        } else {
          vnodeToMove = oldCh[idxInOld];
          // 两个节点相同 更新节点
          if (sameVnode(vnodeToMove, newStartVnode)) {
            patchVnode(
              vnodeToMove,
              newStartVnode,
              insertedVnodeQueue,
              newCh,
              newStartIdx
            );
            oldCh[idxInOld] = undefined;
            canMove &&
              nodeOps.insertBefore(
                parentElm,
                vnodeToMove.elm,
                oldStartVnode.elm
              );
          } else {
            // same key but different element. treat as new element
            // key标识相同情况下 但是节点不同 作为新元素处理 创建元素
            createElm(
              newStartVnode,
              insertedVnodeQueue,
              parentElm,
              oldStartVnode.elm,
              false,
              newCh,
              newStartIdx
            );
          }
        }
        newStartVnode = newCh[++newStartIdx];
      }
    }
    if (oldStartIdx > oldEndIdx) {
      // oldChildren 先循环完 则newChildren里均为新增加节点
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm;
      addVnodes(
        parentElm,
        refElm,
        newCh,
        newStartIdx,
        newEndIdx,
        insertedVnodeQueue
      );
    } else if (newStartIdx > newEndIdx) {
      // newChildren 比 oldChildren 先循环完 则oldChildren剩下的均为需要删除的节点 执行删除
      removeVnodes(oldCh, oldStartIdx, oldEndIdx);
    }
  }
  //判断v-for key值是否有重复 重复则抛异常
  function checkDuplicateKeys(children) {
    const seenKeys = {};
    for (let i = 0; i < children.length; i++) {
      const vnode = children[i];
      const key = vnode.key;
      if (isDef(key)) {
        if (seenKeys[key]) {
          warn(
            `Duplicate keys detected: '${key}'. This may cause an update error.`,
            vnode.context
          );
        } else {
          seenKeys[key] = true;
        }
      }
    }
  }
  // * 寻找旧节点 返回索引
  function findIdxInOld(node, oldCh, start, end) {
    for (let i = start; i < end; i++) {
      const c = oldCh[i];
      if (isDef(c) && sameVnode(node, c)) return i;
    }
  }
  /**
   * @description: 更新节点  虚拟DOM完成DOM更新
   * @param {*}
   * @return {*}
   */
  function patchVnode(
    oldVnode, //旧节点
    vnode,  //新节点
    insertedVnodeQueue,
    ownerArray,
    index,
    removeOnly
  ) {
    //1.新旧节点为静态节点 跳过无需处理
    if (oldVnode === vnode) {
      return;
    }

    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // clone reused vnode
      vnode = ownerArray[index] = cloneVNode(vnode);
    }

    const elm = (vnode.elm = oldVnode.elm);
    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      if (isDef(vnode.asyncFactory.resolved)) {
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue);
      } else {
        vnode.isAsyncPlaceholder = true;
      }
      return;
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    // 如果新旧vnode均为静态&&key相同&&(新vnode是克隆||拥有v-once属性) 
    // 则新vnode实例采用旧vnode实例 保持不变
    if (
      isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance;
      return;
    }

    let i;
    const data = vnode.data;
    // 执行data.hook.prepatch钩子
    if (isDef(data) && isDef((i = data.hook)) && isDef((i = i.prepatch))) {
      i(oldVnode, vnode);
    }

    const oldCh = oldVnode.children;
    const ch = vnode.children;
    if (isDef(data) && isPatchable(vnode)) {
      // 遍历cbs  执行update
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      
      // 执行data.hook.update钩子
      if (isDef((i = data.hook)) && isDef((i = i.update))) i(oldVnode, vnode);
    }
    //2.vnode如果没有text属性 新VNode为元素节点
    if (isUndef(vnode.text)) {
      // 2.1 新旧节点 子节点是否都存在
      if (isDef(oldCh) && isDef(ch)) {
        //都存在 判断子节点是否相同，不同更新子节点
        if (oldCh !== ch)
        // 更新子节点
          updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly);
      } 
      //只有vnode子节点存在
      else if (isDef(ch)) {
        if (process.env.NODE_ENV !== "production") {
          checkDuplicateKeys(ch);
        }
        // 清空文本 添加vnode
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, "");
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } 
      else if (isDef(oldCh)) {
        // 移除vnode
        removeVnodes(oldCh, 0, oldCh.length - 1);
      } 
      else if (isDef(oldVnode.text)) {
        //如果新旧vnode没有text属性  清空文本
        nodeOps.setTextContent(elm, "");
      }
    } 
    //3. vnode为文本属性
    else if (oldVnode.text !== vnode.text) {
      //不同则用vnode的text替换真实DOM文本
      nodeOps.setTextContent(elm, vnode.text);
    }
    if (isDef(data)) {
      // 执行 data.hook.postpatch 钩子，表明 patch 完毕 （更新结束）
      if (isDef((i = data.hook)) && isDef((i = i.postpatch)))
        i(oldVnode, vnode);
    }
  }

  function invokeInsertHook(vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue;
    } else {
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i]);
      }
    }
  }

  let hydrationBailed = false;
  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // Note: style is excluded because it relies on initial clone for future
  // deep updates (#7063).
  const isRenderedModule = makeMap("attrs,class,staticClass,staticStyle,key");

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  // 只支持浏览器的函数 elm假设为node节点
  function hydrate(elm, vnode, insertedVnodeQueue, inVPre) {
    let i;
    const { tag, data, children } = vnode;
    inVPre = inVPre || (data && data.pre);
    vnode.elm = elm;

    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.isAsyncPlaceholder = true;
      return true;
    }
    // assert node match
    if (process.env.NODE_ENV !== "production") {
      if (!assertNodeMatch(elm, vnode, inVPre)) {
        return false;
      }
    }
    if (isDef(data)) {
      if (isDef((i = data.hook)) && isDef((i = i.init)))
        i(vnode, true /* hydrating */);
      if (isDef((i = vnode.componentInstance))) {
        // child component. it should have hydrated its own tree.
        initComponent(vnode, insertedVnodeQueue);
        return true;
      }
    }
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue);
        } else {
          // v-html and domProps: innerHTML
          if (
            isDef((i = data)) &&
            isDef((i = i.domProps)) &&
            isDef((i = i.innerHTML))
          ) {
            if (i !== elm.innerHTML) {
              /* istanbul ignore if */
              if (
                process.env.NODE_ENV !== "production" &&
                typeof console !== "undefined" &&
                !hydrationBailed
              ) {
                hydrationBailed = true;
                console.warn("Parent: ", elm);
                console.warn("server innerHTML: ", i);
                console.warn("client innerHTML: ", elm.innerHTML);
              }
              return false;
            }
          } else {
            // iterate and compare children lists
            let childrenMatch = true;
            let childNode = elm.firstChild;
            for (let i = 0; i < children.length; i++) {
              if (
                !childNode ||
                !hydrate(childNode, children[i], insertedVnodeQueue, inVPre)
              ) {
                childrenMatch = false;
                break;
              }
              childNode = childNode.nextSibling;
            }
            // if childNode is not null, it means the actual childNodes list is
            // longer than the virtual children list.
            if (!childrenMatch || childNode) {
              /* istanbul ignore if */
              if (
                process.env.NODE_ENV !== "production" &&
                typeof console !== "undefined" &&
                !hydrationBailed
              ) {
                hydrationBailed = true;
                console.warn("Parent: ", elm);
                console.warn(
                  "Mismatching childNodes vs. VNodes: ",
                  elm.childNodes,
                  children
                );
              }
              return false;
            }
          }
        }
      }
      if (isDef(data)) {
        let fullInvoke = false;
        for (const key in data) {
          if (!isRenderedModule(key)) {
            fullInvoke = true;
            invokeCreateHooks(vnode, insertedVnodeQueue);
            break;
          }
        }
        if (!fullInvoke && data["class"]) {
          // ensure collecting deps for deep class bindings for future updates
          traverse(data["class"]);
        }
      }
    } else if (elm.data !== vnode.text) {
      elm.data = vnode.text;
    }
    return true;
  }

  function assertNodeMatch(node, vnode, inVPre) {
    if (isDef(vnode.tag)) {
      return (
        vnode.tag.indexOf("vue-component") === 0 ||
        (!isUnknownElement(vnode, inVPre) &&
          vnode.tag.toLowerCase() ===
            (node.tagName && node.tagName.toLowerCase()))
      );
    } else {
      return node.nodeType === (vnode.isComment ? 8 : 3);
    }
  }



  // 虚拟DOM 的核心
  // 初始化/更新视图 =》 走向 _update方法  update位置src/core/instance/lifecycle.js
  return function patch(oldVnode, vnode, hydrating, removeOnly) {
    //当前vnode未定义
    if (isUndef(vnode)) {
      //旧节点定义了 调用销毁钩子
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode);
      return;
    }
    //是否初始化节点
    let isInitialPatch = false;
    // 插入vnode队列
    const insertedVnodeQueue = [];
    // 旧vnode未定义
    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      //初始化 创建节点
      isInitialPatch = true;
      createElm(vnode, insertedVnodeQueue);
    } else {
      //旧vnode存在  是否是真实dom元素
      const isRealElement = isDef(oldVnode.nodeType);
      //非dom元素  新旧vnode相同
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // patch existing root node
        //修改已有根节点
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly);
      } else {
        //是真实节点  处理旧vnode
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          //挂在一个真实元素 且 为服务端渲染或者可以执行成功的合并到真实DOM
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR);
            hydrating = true;
          }
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              //调用insert钩子
              // inserted：被绑定元素插入父节点时调用 
              invokeInsertHook(vnode, insertedVnodeQueue, true);
              return oldVnode;
            } 
            else if (process.env.NODE_ENV !== "production") {
              warn(
                "The client-side rendered virtual DOM tree is not matching " +
                  "server-rendered content. This is likely caused by incorrect " +
                  "HTML markup, for example nesting block-level elements inside " +
                  "<p>, or missing <tbody>. Bailing hydration and performing " +
                  "full client-side render."
              );
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          // 非服务端渲染或者合并到真实DOM失败
          // 创建空节点替换旧的节点
          oldVnode = emptyNodeAt(oldVnode);
        }

        // replacing existing element
        // 替换已存在的元素
        const oldElm = oldVnode.elm;  //旧节点
        const parentElm = nodeOps.parentNode(oldElm);  //父元素节点

        // create new node
        //创建新节点
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        );

        // update parent placeholder node element, recursively
        // 递归更新父级占位节点元素
        if (isDef(vnode.parent)) {
          let ancestor = vnode.parent;
          const patchable = isPatchable(vnode);
          while (ancestor) {
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor);
            }
            ancestor.elm = vnode.elm;
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor);
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              const insert = ancestor.data.hook.insert;
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                for (let i = 1; i < insert.fns.length; i++) {
                  insert.fns[i]();
                }
              }
            } else {
              registerRef(ancestor);
            }
            ancestor = ancestor.parent;
          }
        }

        // destroy old node
        //销毁 旧节点
        if (isDef(parentElm)) {
          removeVnodes([oldVnode], 0, 0);
        } else if (isDef(oldVnode.tag)) {
          invokeDestroyHook(oldVnode);
        }
      }
    }
    //调用insert钩子
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch);
    return vnode.elm;
  };
}
