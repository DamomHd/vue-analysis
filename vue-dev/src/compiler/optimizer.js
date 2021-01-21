/* @flow */

import { makeMap, isBuiltInTag, cached, no } from "shared/util";

let isStaticKey;
let isPlatformReservedTag;

const genStaticKeysCached = cached(genStaticKeys);

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 * 优化AST
 */

export function optimize(root: ?ASTElement, options: CompilerOptions) {
  if (!root) return;
  isStaticKey = genStaticKeysCached(options.staticKeys || "");
  isPlatformReservedTag = options.isReservedTag || no;
  // first pass: mark all non-static nodes.
  // 标记静态节点
  markStatic(root);
  // second pass: mark static roots.
  //标记静态根节点
  markStaticRoots(root, false);
}

function genStaticKeys(keys: string): Function {
  return makeMap(
    "type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap" +
      (keys ? "," + keys : "")
  );
}
// 标记静态节点
function markStatic(node: ASTNode) {
  node.static = isStatic(node);
  // 元素节点
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== "slot" &&
      node.attrsMap["inline-template"] == null
    ) {
      return;
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i];
      markStatic(child);
      // 子节点有一个非静态节点 则需要将当前节点重新设置为非静态节点
      if (!child.static) {
        node.static = false;
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block;
        markStatic(block);
        if (!block.static) {
          node.static = false;
        }
      }
    }
  }
}
//标记静态根节点

function markStaticRoots(node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor;
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 成为静态根节点的条件 节点自身为静态节点+需要拥有子节点children+子节点不能只有一个文本节点
    // 否则优化成本大于优化后的效益
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) {
      node.staticRoot = true;
      return;
    } else {
      node.staticRoot = false;
    }
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for);
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor);
      }
    }
  }
}
/**
 * @description: 判断是否是静态节点
 * @param {*} node
 * @return {*}
 */
function isStatic(node: ASTNode): boolean {
  // 包含变量的动态文本节点
  if (node.type === 2) {
    // expression
    return false;
  }
  // 不包含变量的纯文本节点
  if (node.type === 3) {
    // text
    return true;
  }
  // type == 1 元素节点 进一步判断
  /**
   * 1.使用了v-pre 断定为静态节点
   * 2.没使用v-pre 需满足几个条件才是静态节点
   *   不能使用动态绑定语法 标签不能包含 v-  @  :开头的属性
   *   不能使用v-for  v-else  v-for指令
   *   不能是内置组件 标签不能是slot或者component
   *   标签名为保留标签 不能是组件
   *   当前节点不能是带有v-for的template标签
   *   节点所属的key必须是静态节点才有的key （只能是type/tag/attrsList/attrsMap/plain/children/attrs之一）
   */
  return !!(
    node.pre ||
    (!node.hasBindings && // no dynamic bindings 不包含bind
      !node.if &&
      !node.for && // not v-if or v-for or v-else  不包含 v-if/for/else
      !isBuiltInTag(node.tag) && // not a built-in
      isPlatformReservedTag(node.tag) && // not a component
      !isDirectChildOfTemplateFor(node) &&
      Object.keys(node).every(isStaticKey))
  );
}

function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent;
    if (node.tag !== "template") {
      return false;
    }
    if (node.for) {
      return true;
    }
  }
  return false;
}
