import observable from 'riot-observable'
import RefExpr from './ref'
import update from './update'
import { mixin } from './core'
import { setAttr, remAttr, getAttr } from './../common/util/dom'
import {
  parseDom, mountDom,
  parseAttributes, mountAttribute,
  convertHtml, convertAttrString,
  Virtual
} from './parse'

import {
  isFunction,
  isString
} from './../common/util/check'

import {
  extend,
  each,
  startsWith,
  toCamel,
  defineProperty
} from './../common/util/misc'

import {
  cleanUpData,
  unmountAll,
  arrayishAdd,
  arrayishRemove,
  inheritFrom,
  getTagName,
} from './../common/util/tags'

import {
  GLOBAL_MIXIN,
  __TAGS_CACHE,
  RIOT_PREFIX,
  RIOT_TAG_IS
} from './../common/global-variables'

// counter to give a unique id to all the Tag instances
var __uid = 0


Tag.parse = function(node, impl, virtualHandled) {
  let instAttrs = parseAttributes(node.attributes, true)

  impl.template = impl.template || parseDom(convertHtml(impl.html))

  if (typeof(impl.attrs) === 'string') {
    impl.attrs = parseAttributes(convertAttrString(impl.attrs), true)
  }
  impl.attrs = impl.attrs || []

  let innerDom = document.createDocumentFragment(), ch
  while(ch = node.firstChild) innerDom.appendChild(ch)

  let takenByInst = {}
  each(instAttrs, a => takenByInst[a.name] = 1)
  let implAttrs = impl.attrs.filter(a => !takenByInst[a.name])

  return {type: Tag, impl, instAttrs, implAttrs}
}


export default function Tag(prep, node, parent) {
  let impl = prep.impl
  let opts = this.opts = prep.opts || {}
  let intl = this._internal = {impl, expressions: []}

  // If this node is already mounted, unmount it
  if (node._tag) node._tag.unmount(true)

  if (node.nodeType === 3)
    node = new Virtual(node)

  // Public-facing properties of the tag
  defineProperty(this, '_riot_id', ++__uid) // base 1 allows test !t._riot_id
  this.parent = parent
  this.root = node
  this.refs = {}
  this.tags = {}
  node._tag = this

  observable(this)

  // register with our parent tag
  if (parent && parent.tags)
    arrayishAdd(parent.tags, impl.name, this)

  // All attributes on the root node become opts. If the attribute has an
  // expression, we mount and update it now, so that opts will have the correct
  // values in the constructor.
  intl.instAttrs = prep.instAttrs.map(a => {
    a = mountAttribute(a, node, parent, this)
    opts[a.camel] = a.value
    return a
  })

  impl.fn && impl.fn.call(this, opts) // constructor
  this.trigger('before-mount')

  intl.implAttrs = prep.implAttrs.map(a => {
    a = mountAttribute(a, node, this)
    setAttr(node, a.name, a.value)
    return a
  })

  // Create the contents of this Tag, and all expressions
  let block = mountDom(impl.template, this)
  intl.expressions = intl.implAttrs.concat(block.expressions)
  node.appendChild(block.root)

  // Only issue the 'mount' event once our parent is mounted. This ensures that
  // mount is only called once the tag is in the DOM tree.
  this.isMounted = true
  if (!parent || parent.isMounted) this.trigger('mount')
  else parent.one('mount', () => this.trigger('mount'))
}


Tag.prototype.update = function updateTag(data) {
  let {instAttrs, expressions} = this._internal
  let {root, parent} = this

  // first update opts
  for (let attr of instAttrs) {
    // This supports a weird API where users can manually change attributes
    // of a top-level tag, and it will update opts. I'd love to remove it.
    if (!parent && !attr.update)
      attr.value = getAttr(root, attr.name)

    attr.update && attr.update()
    this.opts[attr.camel] = attr.value
  }

  // apply the data argument, if provided
  // extend(this, cleanUpData(data))

  this.trigger('update')

  for (let exp of expressions)
    exp.update()
}


Tag.prototype.unmount = function(keepRoot) {
  var root = this.root, pNode = root.parentNode, pTag = this.parent
  var intl = this._internal

  if (!this.isMounted) return

  this.trigger('before-unmount')

  // remove this tag instance from the global virtualDom variable
  var tagIndex = __TAGS_CACHE.indexOf(this)
  if (~tagIndex) __TAGS_CACHE.splice(tagIndex, 1)

  if (pTag)
    arrayishRemove(pTag.tags, intl.impl.name, this)

  // unmount all expressions (this includes child tags)
  for(let exp of intl.expressions)
    exp.unmount && exp.unmount()

  // remove all innerHTML
  while (root.firstChild) root.removeChild(root.firstChild)

  // we remove the root node too, unless the user requests it remain
  if (pNode && !keepRoot) pNode.removeChild(root)

  // reset all instance attributes back to their original values
  each(intl.instAttrs, a => {
    if (a.unmount) a.unmount()
    setAttr(root, a.name, a.raw)
  })

  // remove all implAttrs
  each(intl.implAttrs, a => remAttr(root, a.name))

  this.trigger('unmount')
  this.off('*')
  this.isMounted = false

  delete root._tag

  return this
}


// TODO: refactor for better performance
Tag.prototype.mixin = function tagMixin() {
  each(arguments, (mix) => {
    var instance,
      props = [],
      obj

    mix = isString(mix) ? mixin(mix) : mix

    // check if the mixin is a function
    if (isFunction(mix)) {
      // create the new mixin instance
      instance = new mix()
    } else instance = mix

    var proto = Object.getPrototypeOf(instance)

    // build multilevel prototype inheritance chain property list
    do props = props.concat(Object.getOwnPropertyNames(obj || instance))
    while (obj = Object.getPrototypeOf(obj || instance))

    // loop the keys in the function prototype or the all object keys
    each(props, (key) => {
      // bind methods to this
      // allow mixins to override other properties/parent mixins
      if (key !== 'init') {
        // check for getters/setters
        var descriptor = Object.getOwnPropertyDescriptor(instance, key) || Object.getOwnPropertyDescriptor(proto, key)
        var hasGetterSetter = descriptor && (descriptor.get || descriptor.set)

        // apply method only if it does not already exist on the instance
        if (!this.hasOwnProperty(key) && hasGetterSetter) {
          Object.defineProperty(this, key, descriptor)
        } else {
          this[key] = isFunction(instance[key]) ?
            instance[key].bind(this) :
            instance[key]
        }
      }
    })

    // init method will be called automatically
    if (instance.init)
      instance.init.bind(this)()
  })
  return this
}

