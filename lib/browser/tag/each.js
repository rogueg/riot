import { isArray } from './../common/util/check'
import { remAttr, getAttr, getOuterHTML, createDOMPlaceholder, safeInsert, createFrag, removeBlock } from './../common/util/dom'
import { defineProperty, each, contains, extend } from './../common/util/misc'
import { tmpl } from 'riot-tmpl'
import Tag from './tag'
import { parseDom, mountDom } from './parse'

import {
  T_STRING,
  T_OBJECT,
  __TAG_IMPL,
  RE_SPECIAL_TAGS
} from './../common/global-variables'

import {
  moveChildTag,
  getTag,
  getTagName,
  arrayishAdd,
  arrayishRemove,
  makeVirtual,
  moveVirtual
} from './../common/util/tags'

/**
 * Convert the item looped into an object used to extend the child tag properties
 * @param   { Object } expr - object containing the keys used to extend the children tags
 * @param   { * } key - value to assign to the new object returned
 * @param   { * } val - value containing the position of the item in the array
 * @param   { Object } base - prototype object for the new item
 * @returns { Object } - new object containing the values of the original item
 *
 * The variables 'key' and 'val' are arbitrary.
 * They depend on the collection type looped (Array, Object)
 * and on the expression used on the each tag
 *
 */
function mkitem(expr, key, val, base) {
  var item = base ? Object.create(base) : {}
  if (expr.key) item[expr.key] = key
  else extend(item, key)
  if (expr.pos) item[expr.pos] = val
  return item
}

/**
 * Unmount the redundant tags
 * @param   { Array } items - array containing the current items to loop
 * @param   { Array } tags - array containing all the children tags
 * @param   { String } tagName - key used to identify the type of tag
 * @param   { Object } parent - parent tag to remove the child from
 */
function unmountRedundant(items, blocks) {

  var i = blocks.length,
    j = items.length,
    b

  while (i > j) {
    b = blocks[--i]
    blocks.splice(i, 1)
    removeBlock(b)
  }
}

/**
 * Move a child tag
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Tag } nextTag - instance of the next tag preceding the one we want to move
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function move(root, nextTag, isVirtual) {
  if (isVirtual)
    moveVirtual.apply(this, [root, nextTag])
  else
    safeInsert(root, this.root, nextTag.root)
}

/**
 * Insert and mount a child tag
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Tag } nextTag - instance of the next tag preceding the one we want to insert
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function insert(block, nextTag, root) {
  if (isVirtual)
    makeVirtual.apply(this, [root, nextTag])
  else
    safeInsert(root, this.root, nextTag.root)
}

/**
 * Append a new tag into the DOM
 * @this Tag
 * @param   { HTMLElement } root - dom node containing all the loop children
 * @param   { Boolean } isVirtual - is it a virtual tag?
 */
function append(block, frag) {
  // if (isVirtual)
  //   makeVirtual.call(this, root)

}

/**
 * Manage tags having the 'each'
 * @param   { HTMLElement } dom - DOM node we need to loop
 * @param   { Tag } parent - parent tag instance where the dom node is contained
 * @param   { String } expr - string contained in the 'each' attribute
 * @returns { Object } expression object for this each loop
 */


export function _each(seed, stub, scope) {
  var useRoot = false, //RE_SPECIAL_TAGS.test(tagName),
    eachExpr = seed.eachExpr,
    ifExpr = seed.ifExpr,
    // root = dom.parentNode,
    blocks = [],
    oldItems = [],
    hasKeys,
    isVirtual = seed.isVirtual

  this.update = function updateEach() {
    var root = stub.parentNode

    // get the new items collection
    var items = tmpl(eachExpr.val, scope)
    var tailItemsFrag = document.createDocumentFragment()

    // // object loop. any changes cause full redraw
    // if (!isArray(items)) {
    //   hasKeys = items || false
    //   items = hasKeys ?
    //     Object.keys(items).map(function (key) {
    //       return mkitem(eachExpr, items[key], key)
    //     }) : []
    // } else {
    //   hasKeys = false
    // }
    //
    // if (ifExpr) {
    //   items = items.filter(function(item, i) {
    //     if (eachExpr.key) {
    //       return !!tmpl(ifExpr, mkitem(eachExpr, item, i, parent))
    //     }
    //     // in case it's not a keyed loop
    //     // we test the validity of the if expression against
    //     // the item and the parent
    //     return !!tmpl(ifExpr, parent) || !!tmpl(ifExpr, item)
    //   })
    // }

    // loop all the new items
    each(items, function(item, i) {
      // reorder only if the items are objects
      var
        _mustReorder = seed.mustReorder && typeof item === T_OBJECT && !hasKeys,
        oldPos = oldItems.indexOf(item),
        pos = ~oldPos && _mustReorder ? oldPos : i,
        // does a tag exist in this position?
        block = blocks[pos]

      // item = !hasKeys && eachExpr.key ? mkitem(eachExpr, item, i) : item

      // new tag
      if (
        !_mustReorder && !block // with no-reorder we just update the old block
        ||
        _mustReorder && !~oldPos // by default we always try to reorder the DOM elements
      ) {

        let mustAppend = i === blocks.length

        let itemScope = mkitem(eachExpr, item, i, scope)
        itemScope.parent = scope // This supports the 3.x API. Remove in 4.0

        let block = mountDom(seed.template, itemScope)
        block.itemScope = itemScope

        if (mustAppend) tailItemsFrag.appendChild(block.root)
        else root.insertBefore(block.root, blocks[i].head || blocks[i].root)

        if (!mustAppend) oldItems.splice(i, 0, item)
        blocks.splice(i, 0, block)
        pos = i // handled here so no move
      } else {
        // if you don't use keys, we need to re-copy data onto the item each time,
        // because we don't know what might have changed.
        if (!hasKeys && !eachExpr.key) extend(block.itemScope, item)
        for(let exp of block.expressions) exp.update()
      }

      // reorder the tag if it's not located in its previous position
      if (pos !== i && _mustReorder) {
        // #closes 2040
        if (contains(items, oldItems[i])) {
          move.apply(block, [root, blocks[i], isVirtual])
        }
        // update the position attribute if it exists
        if (eachExpr.pos) item[eachExpr.pos] = i
        // move the old tag instance
        blocks.splice(i, 0, blocks.splice(pos, 1)[0])
        // move the old item
        oldItems.splice(i, 0, oldItems.splice(pos, 1)[0])
      }
    })

    // remove the redundant tags
    unmountRedundant(items, blocks)

    // clone the items array
    oldItems = items.slice()

    root.insertBefore(tailItemsFrag, stub)
  }

  this.unmount = function() {
    each(blocks, function(b) {
      each(b.expressions, e => e.unmount && e.unmount())
    })
  }
}

_each.parse = function(node) {
  // take the node out and replace it with a stub
  node.parentNode.replaceChild(document.createTextNode(''), node)

  return {
    type: _each,
    eachExpr: tmpl.loopKeys(remAttr(node, 'each')),
    ifExpr: remAttr(node, 'if'),
    template: parseDom(node),
    mustReorder: typeof getAttr(node, 'no-reorder') !== T_STRING || remAttr(node, 'no-reorder'),
    isVirtual: node.tagName === 'VIRTUAL'
  }
}

