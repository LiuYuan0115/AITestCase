/*! @gera2ld/jsx-dom v2.2.2 | ISC License */
const VTYPE_ELEMENT = 1;
const VTYPE_FUNCTION = 2;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const NS_ATTRS = {
  show: XLINK_NS,
  actuate: XLINK_NS,
  href: XLINK_NS
};

const isLeaf = c => typeof c === 'string' || typeof c === 'number';
const isElement = c => (c == null ? void 0 : c.vtype) === VTYPE_ELEMENT;
const isRenderFunction = c => (c == null ? void 0 : c.vtype) === VTYPE_FUNCTION;
function h(type, props, ...children) {
  props = Object.assign({}, props, {
    children: children.length === 1 ? children[0] : children
  });
  return jsx(type, props);
}
function jsx(type, props) {
  let vtype;
  if (typeof type === 'string') vtype = VTYPE_ELEMENT;else if (typeof type === 'function') vtype = VTYPE_FUNCTION;else throw new Error('Invalid VNode type');
  return {
    vtype,
    type,
    props
  };
}
const jsxs = jsx;
function Fragment(props) {
  return props.children;
}

const DEFAULT_ENV = {
  isSvg: false
};
function insertDom(parent, nodes) {
  if (!Array.isArray(nodes)) nodes = [nodes];
  nodes = nodes.filter(Boolean);
  if (nodes.length) parent.append(...nodes);
}
function mountAttributes(domElement, props, env) {
  for (const key in props) {
    if (key === 'key' || key === 'children' || key === 'ref') continue;
    if (key === 'dangerouslySetInnerHTML') {
      domElement.innerHTML = props[key].__html;
    } else if (key === 'innerHTML' || key === 'textContent' || key === 'innerText' || key === 'value' && ['textarea', 'select'].includes(domElement.tagName)) {
      const value = props[key];
      if (value != null) domElement[key] = value;
    } else if (key.startsWith('on')) {
      domElement[key.toLowerCase()] = props[key];
    } else {
      setDOMAttribute(domElement, key, props[key], env.isSvg);
    }
  }
}
const attrMap = {
  className: 'class',
  labelFor: 'for'
};
function setDOMAttribute(el, attr, value, isSVG) {
  attr = attrMap[attr] || attr;
  if (value === true) {
    el.setAttribute(attr, '');
  } else if (value === false) {
    el.removeAttribute(attr);
  } else {
    const namespace = isSVG ? NS_ATTRS[attr] : undefined;
    if (namespace !== undefined) {
      el.setAttributeNS(namespace, attr, value);
    } else {
      el.setAttribute(attr, value);
    }
  }
}
function flatten(arr) {
  return arr.reduce((prev, item) => prev.concat(item), []);
}
function mountChildren(children, env) {
  return Array.isArray(children) ? flatten(children.map(child => mountChildren(child, env))) : mount(children, env);
}
function mount(vnode, env = DEFAULT_ENV) {
  if (vnode == null || typeof vnode === 'boolean') {
    return null;
  }
  if (vnode instanceof Node) {
    return vnode;
  }
  if (isRenderFunction(vnode)) {
    const {
      type,
      props
    } = vnode;
    if (type === Fragment) {
      const node = document.createDocumentFragment();
      if (props.children) {
        const children = mountChildren(props.children, env);
        insertDom(node, children);
      }
      return node;
    }
    const childVNode = type(props);
    return mount(childVNode, env);
  }
  if (isLeaf(vnode)) {
    return document.createTextNode(`${vnode}`);
  }
  if (isElement(vnode)) {
    let node;
    const {
      type,
      props
    } = vnode;
    if (!env.isSvg && type === 'svg') {
      env = Object.assign({}, env, {
        isSvg: true
      });
    }
    if (!env.isSvg) {
      node = document.createElement(type);
    } else {
      node = document.createElementNS(SVG_NS, type);
    }
    mountAttributes(node, props, env);
    if (props.children) {
      let childEnv = env;
      if (env.isSvg && type === 'foreignObject') {
        childEnv = Object.assign({}, childEnv, {
          isSvg: false
        });
      }
      const children = mountChildren(props.children, childEnv);
      if (children != null) insertDom(node, children);
    }
    const {
      ref
    } = props;
    if (typeof ref === 'function') ref(node);
    return node;
  }
  throw new Error('mount: Invalid Vnode!');
}

/**
 * Mount vdom as real DOM nodes.
 */
function mountDom(vnode) {
  return mount(vnode);
}

/**
 * Render and mount without returning VirtualDOM, useful when you don't need SVG support.
 */
function hm(...args) {
  return mountDom(h(...args));
}

export { Fragment, h as createElement, h, hm, jsx, jsxs, mountDom };
