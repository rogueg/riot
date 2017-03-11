import { XLINK_NS, XLINK_REGEX } from './../global-variables'
import { isUndefined } from './check'
import { each } from './misc'

/**
 * Shorter and fast way to select multiple nodes in the DOM
 * @param   { String } selector - DOM selector
 * @param   { Object } ctx - DOM node where the targets of our search will is located
 * @returns { Object } dom nodes found
 */
export function $$(selector, ctx) {
  return (ctx || document).querySelectorAll(selector)
}

/**
 * Shorter and fast way to select a single node in the DOM
 * @param   { String } selector - unique dom selector
 * @param   { Object } ctx - DOM node where the target of our search will is located
 * @returns { Object } dom node found
 */
export function $(selector, ctx) {
  return (ctx || document).querySelector(selector)
}

/**
 * Create a document fragment
 * @returns { Object } document fragment
 */
export function createFrag() {
  return document.createDocumentFragment()
}

/**
 * Create a document text node
 * @returns { Object } create a text node to use as placeholder
 */
export function createDOMPlaceholder() {
  return document.createTextNode('')
}

/**
 * Create a generic DOM node
 * @param   { String } name - name of the DOM node we want to create
 * @param   { Boolean } isSvg - should we use a SVG as parent node?
 * @returns { Object } DOM node just created
 */
export function mkEl(name, isSvg) {
  return isSvg ?
    document.createElementNS('http://www.w3.org/2000/svg', 'svg') :
    document.createElement(name)
}

/**
 * Get the outer html of any DOM node SVGs included
 * @param   { Object } el - DOM node to parse
 * @returns { String } el.outerHTML
 */
export function getOuterHTML(el) {
  if (el.outerHTML)
    return el.outerHTML
  // some browsers do not support outerHTML on the SVGs tags
  else {
    const container = mkEl('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

/**
 * Set the inner html of any DOM node SVGs included
 * @param { Object } container - DOM node where we'll inject new html
 * @param { String } html - html to inject
 */
export function setInnerHTML(container, html) {
  if (!isUndefined(container.innerHTML))
    container.innerHTML = html
    // some browsers do not support innerHTML on the SVGs tags
  else {
    const doc = new DOMParser().parseFromString(html, 'application/xml')
    const node = container.ownerDocument.importNode(doc.documentElement, true)
    container.appendChild(node)
  }
}

/**
 * Remove any DOM attribute from a node
 * @param   { Object } dom - DOM node we want to update
 * @param   { String } name - name of the property we want to remove
 */
export function remAttr(dom, name) {
  let val = dom.getAttribute(name)
  dom.removeAttribute(name)
  return val
}

/**
 * Get the value of any DOM attribute on a node
 * @param   { Object } dom - DOM node we want to parse
 * @param   { String } name - name of the attribute we want to get
 * @returns { String | undefined } name of the node attribute whether it exists
 */
export function getAttr(dom, name) {
  return dom.getAttribute(name)
}

/**
 * Set any DOM attribute
 * @param { Object } dom - DOM node we want to update
 * @param { String } name - name of the property we want to set
 * @param { String } val - value of the property we want to set
 */
export function setAttr(dom, name, val) {
  var xlink = XLINK_REGEX.exec(name)
  if (xlink && xlink[1])
    dom.setAttributeNS(XLINK_NS, xlink[1], val)
  else
    dom.setAttribute(name, val)
}

export function removeBlock(block) {
  let curr = block.head || block.root
  const pNode = curr.parentNode, tail = block.tail

  each(block.expressions, e => e.unmount && e.unmount(true))

  if (!pNode) return

  // walk through DOM until we hit the tail. This works for regular and virtual blocks.
  let done = false, next
  while(curr && !done) {
    done = !tail || curr === tail
    next = curr.nextSibling
    pNode.removeChild(curr)
    curr = next
  }
}

/**
 * Insert safely a tag to fix #1962 #1649
 * @param   { HTMLElement } root - children container
 * @param   { HTMLElement } curr - node to insert
 * @param   { HTMLElement } next - node that should preceed the current node inserted
 */
export function safeInsert(root, curr, next) {
  root.insertBefore(curr, next.parentNode && next)
}

