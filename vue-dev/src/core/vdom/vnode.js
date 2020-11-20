/*
 * @Descripttion: Vincent
 * @version: v1.0
 * @Author: hongda_huang
 * @Date: 2020-11-17 11:26:33
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2020-11-18 15:48:12
 * @description: VNode类 实例化不同类型的虚拟dom节点
 */
/* @flow */

export default class VNode {
  tag: string | void;
  data: VNodeData | void;
  children: ?Array<VNode>;
  text: string | void;
  elm: Node | void;
  ns: string | void;
  context: Component | void; // rendered in this component's scope
  key: string | number | void;
  componentOptions: VNodeComponentOptions | void;
  componentInstance: Component | void; // component instance
  parent: VNode | void; // component placeholder node

  // strictly internal
  raw: boolean; // contains raw HTML? (server only)
  isStatic: boolean; // hoisted static node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // is a cloned node?
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // async component factory function
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions, //
    asyncFactory?: Function
  ) {
    this.tag = tag; //标签名
    this.data = data; //节点对应的对象
    this.children = children; //子节点
    this.text = text; //节点文本
    this.elm = elm; //虚拟节点对应的真实dom节点
    this.ns = undefined; //当前节点的名字空间
    this.context = context; //组件节点对应的Vue实例
    this.fnContext = undefined; //函数式组件对应的Vue实例
    this.fnOptions = undefined;  //函数式组件的option选项
    this.fnScopeId = undefined;  // 函数化组件ScopeId
    this.key = data && data.key; //节点的key属性  节点标志 优化使用
    this.componentOptions = componentOptions; //组件option选项   如props
    this.componentInstance = undefined; //当前节点对应的组件实例
    this.parent = undefined; //当前节点的父节点
    this.raw = false; //是否为原生HTML或只是普通文本  innerHTML的时候为true，textContent的时候为false
    this.isStatic = false; //静态节点标记
    this.isRootInsert = true; //是否作为跟节点插入
    this.isComment = false; //是否为注释节点
    this.isCloned = false; //是否为克隆节点
    this.isOnce = false; //是否有v-once指令
    this.asyncFactory = asyncFactory;  异步工厂方法 
    this.asyncMeta = undefined;  // 异步Meta
    this.isAsyncPlaceholder = false;  //是否为异步占位
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance;
  }
}
//创建注释节点
export const createEmptyVNode = (text: string = "") => {
  const node = new VNode();
  node.text = text;  //具体注释信息
  node.isComment = true;  //标识是注释节点
  return node;
};


// 创建文本节点
export function createTextVNode(val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val));
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
// 克隆节点
// 用于模板编译优化时使用
export function cloneVNode(vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  );
  cloned.ns = vnode.ns;
  cloned.isStatic = vnode.isStatic;
  cloned.key = vnode.key;
  cloned.isComment = vnode.isComment;
  cloned.fnContext = vnode.fnContext;
  cloned.fnOptions = vnode.fnOptions;
  cloned.fnScopeId = vnode.fnScopeId;
  cloned.asyncMeta = vnode.asyncMeta;
  cloned.isCloned = true;  //克隆节点的标识
  return cloned;                          
}
