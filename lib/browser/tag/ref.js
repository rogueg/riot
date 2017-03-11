import { tmpl } from 'riot-tmpl'
import { isBlank } from './../common/util/check'
import { setAttr, remAttr } from './../common/util/dom'

import {
  arrayishAdd,
  arrayishRemove
} from './../common/util/tags'

Ref.parse = function(node, hasExpr) {
  return {type: Ref, raw: node.value, hasExpr, attrName: node.name}
}

export default function Ref(prep, node, scope, tag) {
  let {raw, hasExpr, attrName} = prep

  // Ref either points to a Tag instance, or DOM node
  let target = tag || node, lastVal

  this.update = function updateRef() {
    let newVal = hasExpr ? tmpl(raw, scope) : raw
    if (newVal === lastVal) return // if theres no change, we're done

    // whatever we had before needs to be removed
    if (!isBlank(lastVal)) {
      arrayishRemove(scope.refs, lastVal, target)
      remAttr(node, attrName)
    }

    // Update the `refs` property of the parent, and set the dom attr
    if (!isBlank(newVal)) {
      arrayishAdd(scope.refs, newVal, target)
      setAttr(node, attrName, newVal)
    }

    lastVal = newVal
  }

  this.unmount = function unmountRef() {
    if (!isBlank(lastVal)) {
      arrayishRemove(scope.refs, lastVal, target)
      remAttr(node, attrName)
    }
    node = 0
  }
}

