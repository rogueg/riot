import If from './if'
import Ref from './ref'
import { _each } from './each'
import Tag from './tag'
import AttrExpr from './attr'
import { tmpl } from 'riot-tmpl'
import { RIOT_TAG_IS, RIOT_PREFIX } from './../common/global-variables'
import {  getAttr } from './../common/util/dom'
import { each, extend, toCamel, startsWith } from './../common/util/misc'
import { getTag } from './../common/util/tags'
import { Each2 } from './each2'


export function parseDom(dom, virtualHandled) {
  let plot = [], idx = -1

  walkNodes(dom, node => {
    let type = node.nodeType, tmp
    idx++

    if (type === 3 && tmpl.hasExpr(node.nodeValue))
      plot[idx] = [{type: TextExpr, text: node.nodeValue}]

    if (type !== 1) return

    if (getAttr(node, 'each')) {
      // plot[idx] = [Each2.parse(node)]
      plot[idx] = [_each.parse(node)]
      return false
    }

    if (getAttr(node, 'if')) {
      plot[idx] = [If.parse(node)]
      return false
    }

    if (tmp = getTag(node)) {
      plot[idx] = [Tag.parse(node, tmp, virtualHandled)]
      return false
    }

    plot[idx] = parseAttributes(node.attributes)
  })

  // var result =

  // if (dom.tagName === 'VIRTUAL') {
  //   let frag = document.createDocumentFragment(), ch
  //   while (ch = dom.firstChild) frag.appendChild(ch)
  //   result.pristine = frag
  //   result.isVirtual = true
  // }

  return {pristine: dom, plot}
}

function cloneNode(n) {
  return n.cloneNode(true)
}

export function mountDom(template, scope) {
  let root = cloneNode(template.pristine)
  let expressions = [], idx = 0, plot = template.plot

  walkNodes(root, function mountNode(node) {
    let row = plot[idx]
    idx++

    if (!row) return

    for(let prep of row) {
      let exp = new prep.type(prep, node, scope)
      if (!(exp instanceof Tag)) exp.update()
      expressions.push(exp)
    }
  })

  return {root, expressions}
}

export function parseAttributes(attrs, includeAll) {
  let result = []

  each(attrs, attr => {
    let name = attr.name, value = attr.nodeValue
    let hasExpr = tmpl.hasExpr(value), exp
    let camel = toCamel(name)

    if (~['ref', 'data-ref'].indexOf(name))
      exp = Ref.parse(attr, hasExpr)

    else if (hasExpr)
      exp = {type: AttrExpr, name, value, camel}

    else if (includeAll)
      exp = {name, value, camel}

    if (exp) {
      exp.raw = value // store the raw string, so we can reset during unmount
      result.push(exp)
    }
  })

  return result
}


export function mountAttribute(attr, node, scope, nodeTag) {
  if (attr.type) {
    attr = new attr.type(attr, node, scope, nodeTag)
    attr.update()
  }
  return attr
}


function TextExpr(prep, node, scope) {
  let lastVal, raw = prep.text

  this.update = function updateText() {
    let value = tmpl(raw, scope)
    if (value === lastVal) return
    node.nodeValue = value
    this.value = lastVal = value
  }
}


export function Virtual(node) {
  var p = node.parentNode
  this.head = node || document.createTextNode('')
  this.tail = document.createTextNode('')
  p.insertBefore(this.tail, this.head.nextSibling)
}

Virtual.prototype.appendChild = function(ch) {
  var p = this.head.parentNode
  p.insertBefore(ch, this.tail)
}

Virtual.prototype.getAttribute = function() {}
Virtual.prototype.removeAttribute = function() {}
Virtual.prototype.setAttribute = function() {}


export function convertHtml(html) {
  let el = document.createElement('div'), frag = document.createDocumentFragment(), ch
  el.innerHTML = html
  while (ch = el.firstChild) frag.appendChild(ch)
  return frag
}

// TODO: get a better format from the compiler
export function convertAttrString(str) {
  if (!str) return []
  let result = [], m
  while (m = RE_HTML_ATTRS.exec(str)) {
    let name = m[1].toLowerCase()

    // TODO: not sure why the compiler does this. We should remove it.
    if (startsWith(name, RIOT_PREFIX))
      name = name.slice(RIOT_PREFIX.length)

    result.push({name: name, nodeValue: m[2] || m[3] || m[4]})
  }
  return result
}
const RE_HTML_ATTRS = /([-\w]+) ?= ?(?:"([^"]*)|'([^']*)|({[^}]*}))/g

/**
 * Walk down recursively all the children tags starting dom node
 * @param   { Object }   dom - starting node where we will start the recursion
 * @param   { Function } fn - callback to transform the child node just found
 * @param   { Object }   context - fn can optionally return an object, which is passed to children
 */
function walkNodes(dom, fn) {
  // let remaining = [dom], curr, terminal
  //
  // while(curr = remaining.shift()) {
  //   terminal = curr.childNodes.length === 0
  //   if (fn(curr) === false) continue
  //   if (!terminal)
  //     remaining.unshift.apply(remaining, curr.childNodes)
  // }
  if (!dom) return
  const res = fn(dom)
  var next
  // stop the recursion
  if (res === false) return

  dom = dom.firstChild

  while (dom) {
    next = dom.nextSibling
    walkNodes(dom, fn)
    dom = next
  }
}
