import { remAttr, removeBlock } from './../common/util/dom'
import { unmountAll } from './../common/util/tags'
import { tmpl } from 'riot-tmpl'
import { parseDom, mountDom } from './parse'
import update from './update'

If.parse = function(node) {
  node.parentNode.replaceChild(document.createTextNode(''), node)
  let expr = remAttr(node, 'if')
  let template = parseDom(node)

  return {type: If, expr, template}
}

export default function If(prep, stub, scope) {
  let {expr, template} = prep
  let lastVal = false, block

  this.update = function updateIf() {
    let newVal = !!tmpl(expr, scope)

    // if there's no change, but the expr is true, just update
    if (newVal === lastVal && newVal) {
      // use a for loop for a flatter, more debuggable stack
      for(let exp of block.expressions) exp.update()
    }

    // not making any changes to the DOM
    if (newVal === lastVal) return

    if (newVal) { // mount a fresh copy of DOM
      block = mountDom(template, scope)
      stub.parentNode.insertBefore(block.root, stub)
    }

    else { // unmount and remove from DOM
      removeBlock(block)
      block = 0
    }
    lastVal = newVal
  }

  this.unmount = function unmountIf() {
    block && removeBlock(block)
  }
}
