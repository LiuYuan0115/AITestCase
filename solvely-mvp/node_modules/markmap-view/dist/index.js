import { Hook as st, getId as at, debounce as lt, addClass as ct, walkTree as T, childSelector as C, noop as M } from "markmap-common";
import { loadCSS as Ce, loadJS as we } from "markmap-common";
import { scaleOrdinal as V, schemeCategory10 as ht, zoomTransform as A, select as dt, zoom as ut, linkHorizontal as pt, min as H, max as L, zoomIdentity as ft, minIndex as mt } from "d3";
const K = typeof navigator < "u" && navigator.userAgent.includes("Macintosh"), gt = V(ht), P = {
  autoFit: !1,
  color: (e) => {
    var t;
    return gt(`${((t = e.state) == null ? void 0 : t.path) || ""}`);
  },
  duration: 500,
  embedGlobalCSS: !0,
  fitRatio: 0.95,
  maxWidth: 0,
  nodeMinHeight: 16,
  paddingX: 8,
  scrollForPan: K,
  spacingHorizontal: 80,
  spacingVertical: 5,
  initialExpandLevel: -1,
  zoom: !0,
  pan: !0,
  toggleRecursively: !1
};
function Se(e) {
  const t = {}, n = { ...e }, { color: i, colorFreezeLevel: o } = n;
  if ((i == null ? void 0 : i.length) === 1) {
    const s = i[0];
    t.color = () => s;
  } else if (i != null && i.length) {
    const s = V(i);
    t.color = (l) => s(`${l.state.path}`);
  }
  if (o) {
    const s = t.color || P.color;
    t.color = (l) => (l = {
      ...l,
      state: {
        ...l.state,
        path: l.state.path.split(".").slice(0, o).join(".")
      }
    }, s(l));
  }
  return ["duration", "maxWidth", "initialExpandLevel"].forEach((s) => {
    const l = n[s];
    typeof l == "number" && (t[s] = l);
  }), ["zoom", "pan"].forEach((s) => {
    const l = n[s];
    l != null && (t[s] = !!l);
  }), t;
}
/*! @gera2ld/jsx-dom v2.2.2 | ISC License */
const U = 1, G = 2, xt = "http://www.w3.org/2000/svg", _ = "http://www.w3.org/1999/xlink", yt = {
  show: _,
  actuate: _,
  href: _
}, kt = (e) => typeof e == "string" || typeof e == "number", vt = (e) => (e == null ? void 0 : e.vtype) === U, St = (e) => (e == null ? void 0 : e.vtype) === G;
function j(e, t) {
  let n;
  if (typeof e == "string")
    n = U;
  else if (typeof e == "function")
    n = G;
  else
    throw new Error("Invalid VNode type");
  return {
    vtype: n,
    type: e,
    props: t
  };
}
function bt(e) {
  return e.children;
}
const zt = {
  isSvg: !1
};
function I(e, t) {
  Array.isArray(t) || (t = [t]), t = t.filter(Boolean), t.length && e.append(...t);
}
function Et(e, t, n) {
  for (const i in t)
    if (!(i === "key" || i === "children" || i === "ref"))
      if (i === "dangerouslySetInnerHTML")
        e.innerHTML = t[i].__html;
      else if (i === "innerHTML" || i === "textContent" || i === "innerText" || i === "value" && ["textarea", "select"].includes(e.tagName)) {
        const o = t[i];
        o != null && (e[i] = o);
      } else
        i.startsWith("on") ? e[i.toLowerCase()] = t[i] : wt(e, i, t[i], n.isSvg);
}
const Ct = {
  className: "class",
  labelFor: "for"
};
function wt(e, t, n, i) {
  if (t = Ct[t] || t, n === !0)
    e.setAttribute(t, "");
  else if (n === !1)
    e.removeAttribute(t);
  else {
    const o = i ? yt[t] : void 0;
    o !== void 0 ? e.setAttributeNS(o, t, n) : e.setAttribute(t, n);
  }
}
function Xt(e) {
  return e.reduce((t, n) => t.concat(n), []);
}
function $(e, t) {
  return Array.isArray(e) ? Xt(e.map((n) => $(n, t))) : B(e, t);
}
function B(e, t = zt) {
  if (e == null || typeof e == "boolean")
    return null;
  if (e instanceof Node)
    return e;
  if (St(e)) {
    const {
      type: n,
      props: i
    } = e;
    if (n === bt) {
      const a = document.createDocumentFragment();
      if (i.children) {
        const c = $(i.children, t);
        I(a, c);
      }
      return a;
    }
    const o = n(i);
    return B(o, t);
  }
  if (kt(e))
    return document.createTextNode(`${e}`);
  if (vt(e)) {
    let n;
    const {
      type: i,
      props: o
    } = e;
    if (!t.isSvg && i === "svg" && (t = Object.assign({}, t, {
      isSvg: !0
    })), t.isSvg ? n = document.createElementNS(xt, i) : n = document.createElement(i), Et(n, o, t), o.children) {
      let c = t;
      t.isSvg && i === "foreignObject" && (c = Object.assign({}, c, {
        isSvg: !1
      }));
      const s = $(o.children, c);
      s != null && I(n, s);
    }
    const {
      ref: a
    } = o;
    return typeof a == "function" && a(n), n;
  }
  throw new Error("mount: Invalid Vnode!");
}
function O(e) {
  return B(e);
}
function jt(e) {
  var t = 0, n = e.children, i = n && n.length;
  if (!i)
    t = 1;
  else
    for (; --i >= 0; )
      t += n[i].value;
  e.value = t;
}
function Nt() {
  return this.eachAfter(jt);
}
function Rt(e) {
  var t = this, n, i = [t], o, a, c;
  do
    for (n = i.reverse(), i = []; t = n.pop(); )
      if (e(t), o = t.children, o)
        for (a = 0, c = o.length; a < c; ++a)
          i.push(o[a]);
  while (i.length);
  return this;
}
function Tt(e) {
  for (var t = this, n = [t], i, o; t = n.pop(); )
    if (e(t), i = t.children, i)
      for (o = i.length - 1; o >= 0; --o)
        n.push(i[o]);
  return this;
}
function Mt(e) {
  for (var t = this, n = [t], i = [], o, a, c; t = n.pop(); )
    if (i.push(t), o = t.children, o)
      for (a = 0, c = o.length; a < c; ++a)
        n.push(o[a]);
  for (; t = i.pop(); )
    e(t);
  return this;
}
function At(e) {
  return this.eachAfter(function(t) {
    for (var n = +e(t.data) || 0, i = t.children, o = i && i.length; --o >= 0; )
      n += i[o].value;
    t.value = n;
  });
}
function _t(e) {
  return this.eachBefore(function(t) {
    t.children && t.children.sort(e);
  });
}
function Ot(e) {
  for (var t = this, n = Dt(t, e), i = [t]; t !== n; )
    t = t.parent, i.push(t);
  for (var o = i.length; e !== n; )
    i.splice(o, 0, e), e = e.parent;
  return i;
}
function Dt(e, t) {
  if (e === t)
    return e;
  var n = e.ancestors(), i = t.ancestors(), o = null;
  for (e = n.pop(), t = i.pop(); e === t; )
    o = e, e = n.pop(), t = i.pop();
  return o;
}
function $t() {
  for (var e = this, t = [e]; e = e.parent; )
    t.push(e);
  return t;
}
function Bt() {
  var e = [];
  return this.each(function(t) {
    e.push(t);
  }), e;
}
function Ft() {
  var e = [];
  return this.eachBefore(function(t) {
    t.children || e.push(t);
  }), e;
}
function Ht() {
  var e = this, t = [];
  return e.each(function(n) {
    n !== e && t.push({ source: n.parent, target: n });
  }), t;
}
function F(e, t) {
  var n = new N(e), i = +e.value && (n.value = e.value), o, a = [n], c, s, l, p;
  for (t == null && (t = It); o = a.pop(); )
    if (i && (o.value = +o.data.value), (s = t(o.data)) && (p = s.length))
      for (o.children = new Array(p), l = p - 1; l >= 0; --l)
        a.push(c = o.children[l] = new N(s[l])), c.parent = o, c.depth = o.depth + 1;
  return n.eachBefore(Yt);
}
function Lt() {
  return F(this).eachBefore(Wt);
}
function It(e) {
  return e.children;
}
function Wt(e) {
  e.data = e.data.data;
}
function Yt(e) {
  var t = 0;
  do
    e.height = t;
  while ((e = e.parent) && e.height < ++t);
}
function N(e) {
  this.data = e, this.depth = this.height = 0, this.parent = null;
}
N.prototype = F.prototype = {
  constructor: N,
  count: Nt,
  each: Rt,
  eachAfter: Mt,
  eachBefore: Tt,
  sum: At,
  sort: _t,
  path: Ot,
  ancestors: $t,
  descendants: Bt,
  leaves: Ft,
  links: Ht,
  copy: Lt
};
const Vt = "d3-flextree", Kt = "2.1.2", Pt = "build/d3-flextree.js", Ut = "index", Gt = {
  name: "Chris Maloney",
  url: "http://chrismaloney.org"
}, Zt = "Flexible tree layout algorithm that allows for variable node sizes.", qt = [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "hierarchy",
  "d3-hierarchy",
  "plugin",
  "d3-plugin",
  "infovis",
  "visualization",
  "2d"
], Jt = "https://github.com/klortho/d3-flextree", Qt = "WTFPL", te = {
  type: "git",
  url: "https://github.com/klortho/d3-flextree.git"
}, ee = {
  clean: "rm -rf build demo test",
  "build:demo": "rollup -c --environment BUILD:demo",
  "build:dev": "rollup -c --environment BUILD:dev",
  "build:prod": "rollup -c --environment BUILD:prod",
  "build:test": "rollup -c --environment BUILD:test",
  build: "rollup -c",
  lint: "eslint index.js src",
  "test:main": "node test/bundle.js",
  "test:browser": "node test/browser-tests.js",
  test: "npm-run-all test:*",
  prepare: "npm-run-all clean build lint test"
}, ne = {
  "d3-hierarchy": "^1.1.5"
}, ie = {
  "babel-plugin-external-helpers": "^6.22.0",
  "babel-preset-es2015-rollup": "^3.0.0",
  d3: "^4.13.0",
  "d3-selection-multi": "^1.0.1",
  eslint: "^4.19.1",
  jsdom: "^11.6.2",
  "npm-run-all": "^4.1.2",
  rollup: "^0.55.3",
  "rollup-plugin-babel": "^2.7.1",
  "rollup-plugin-commonjs": "^8.0.2",
  "rollup-plugin-copy": "^0.2.3",
  "rollup-plugin-json": "^2.3.0",
  "rollup-plugin-node-resolve": "^3.0.2",
  "rollup-plugin-uglify": "^3.0.0",
  "uglify-es": "^3.3.9"
}, re = {
  name: Vt,
  version: Kt,
  main: Pt,
  module: Ut,
  "jsnext:main": "index",
  author: Gt,
  description: Zt,
  keywords: qt,
  homepage: Jt,
  license: Qt,
  repository: te,
  scripts: ee,
  dependencies: ne,
  devDependencies: ie
}, { version: oe } = re, se = Object.freeze({
  children: (e) => e.children,
  nodeSize: (e) => e.data.size,
  spacing: 0
});
function q(e) {
  const t = Object.assign({}, se, e);
  function n(s) {
    const l = t[s];
    return typeof l == "function" ? l : () => l;
  }
  function i(s) {
    const l = c(a(), s, (p) => p.children);
    return l.update(), l.data;
  }
  function o() {
    const s = n("nodeSize"), l = n("spacing");
    return class Z extends F.prototype.constructor {
      constructor(h) {
        super(h);
      }
      copy() {
        const h = c(this.constructor, this, (u) => u.children);
        return h.each((u) => u.data = u.data.data), h;
      }
      get size() {
        return s(this);
      }
      spacing(h) {
        return l(this, h);
      }
      get nodes() {
        return this.descendants();
      }
      get xSize() {
        return this.size[0];
      }
      get ySize() {
        return this.size[1];
      }
      get top() {
        return this.y;
      }
      get bottom() {
        return this.y + this.ySize;
      }
      get left() {
        return this.x - this.xSize / 2;
      }
      get right() {
        return this.x + this.xSize / 2;
      }
      get root() {
        const h = this.ancestors();
        return h[h.length - 1];
      }
      get numChildren() {
        return this.hasChildren ? this.children.length : 0;
      }
      get hasChildren() {
        return !this.noChildren;
      }
      get noChildren() {
        return this.children === null;
      }
      get firstChild() {
        return this.hasChildren ? this.children[0] : null;
      }
      get lastChild() {
        return this.hasChildren ? this.children[this.numChildren - 1] : null;
      }
      get extents() {
        return (this.children || []).reduce(
          (h, u) => Z.maxExtents(h, u.extents),
          this.nodeExtents
        );
      }
      get nodeExtents() {
        return {
          top: this.top,
          bottom: this.bottom,
          left: this.left,
          right: this.right
        };
      }
      static maxExtents(h, u) {
        return {
          top: Math.min(h.top, u.top),
          bottom: Math.max(h.bottom, u.bottom),
          left: Math.min(h.left, u.left),
          right: Math.max(h.right, u.right)
        };
      }
    };
  }
  function a() {
    const s = o(), l = n("nodeSize"), p = n("spacing");
    return class extends s {
      constructor(h) {
        super(h), Object.assign(this, {
          x: 0,
          y: 0,
          relX: 0,
          prelim: 0,
          shift: 0,
          change: 0,
          lExt: this,
          lExtRelX: 0,
          lThr: null,
          rExt: this,
          rExtRelX: 0,
          rThr: null
        });
      }
      get size() {
        return l(this.data);
      }
      spacing(h) {
        return p(this.data, h.data);
      }
      get x() {
        return this.data.x;
      }
      set x(h) {
        this.data.x = h;
      }
      get y() {
        return this.data.y;
      }
      set y(h) {
        this.data.y = h;
      }
      update() {
        return J(this), Q(this), this;
      }
    };
  }
  function c(s, l, p) {
    const h = (u, g) => {
      const x = new s(u);
      Object.assign(x, {
        parent: g,
        depth: g === null ? 0 : g.depth + 1,
        height: 0,
        length: 1
      });
      const f = p(u) || [];
      return x.children = f.length === 0 ? null : f.map((y) => h(y, x)), x.children && Object.assign(x, x.children.reduce(
        (y, m) => ({
          height: Math.max(y.height, m.height + 1),
          length: y.length + m.length
        }),
        x
      )), x;
    };
    return h(l, null);
  }
  return Object.assign(i, {
    nodeSize(s) {
      return arguments.length ? (t.nodeSize = s, i) : t.nodeSize;
    },
    spacing(s) {
      return arguments.length ? (t.spacing = s, i) : t.spacing;
    },
    children(s) {
      return arguments.length ? (t.children = s, i) : t.children;
    },
    hierarchy(s, l) {
      const p = typeof l > "u" ? t.children : l;
      return c(o(), s, p);
    },
    dump(s) {
      const l = n("nodeSize"), p = (h) => (u) => {
        const g = h + "  ", x = h + "    ", { x: f, y } = u, m = l(u), k = u.children || [], v = k.length === 0 ? " " : `,${g}children: [${x}${k.map(p(x)).join(x)}${g}],${h}`;
        return `{ size: [${m.join(", ")}],${g}x: ${f}, y: ${y}${v}},`;
      };
      return p(`
`)(s);
    }
  }), i;
}
q.version = oe;
const J = (e, t = 0) => (e.y = t, (e.children || []).reduce((n, i) => {
  const [o, a] = n;
  J(i, e.y + e.ySize);
  const c = (o === 0 ? i.lExt : i.rExt).bottom;
  o !== 0 && le(e, o, a);
  const s = ge(c, o, a);
  return [o + 1, s];
}, [0, null]), ae(e), me(e), e), Q = (e, t, n) => {
  typeof t > "u" && (t = -e.relX - e.prelim, n = 0);
  const i = t + e.relX;
  return e.relX = i + e.prelim - n, e.prelim = 0, e.x = n + e.relX, (e.children || []).forEach((o) => Q(o, i, e.x)), e;
}, ae = (e) => {
  (e.children || []).reduce((t, n) => {
    const [i, o] = t, a = i + n.shift, c = o + a + n.change;
    return n.relX += c, [a, c];
  }, [0, 0]);
}, le = (e, t, n) => {
  const i = e.children[t - 1], o = e.children[t];
  let a = i, c = i.relX, s = o, l = o.relX, p = !0;
  for (; a && s; ) {
    a.bottom > n.lowY && (n = n.next);
    const h = c + a.prelim - (l + s.prelim) + a.xSize / 2 + s.xSize / 2 + a.spacing(s);
    (h > 0 || h < 0 && p) && (l += h, ce(o, h), he(e, t, n.index, h)), p = !1;
    const u = a.bottom, g = s.bottom;
    u <= g && (a = ue(a), a && (c += a.relX)), u >= g && (s = de(s), s && (l += s.relX));
  }
  !a && s ? pe(e, t, s, l) : a && !s && fe(e, t, a, c);
}, ce = (e, t) => {
  e.relX += t, e.lExtRelX += t, e.rExtRelX += t;
}, he = (e, t, n, i) => {
  const o = e.children[t], a = t - n;
  if (a > 1) {
    const c = i / a;
    e.children[n + 1].shift += c, o.shift -= c, o.change -= i - c;
  }
}, de = (e) => e.hasChildren ? e.firstChild : e.lThr, ue = (e) => e.hasChildren ? e.lastChild : e.rThr, pe = (e, t, n, i) => {
  const o = e.firstChild, a = o.lExt, c = e.children[t];
  a.lThr = n;
  const s = i - n.relX - o.lExtRelX;
  a.relX += s, a.prelim -= s, o.lExt = c.lExt, o.lExtRelX = c.lExtRelX;
}, fe = (e, t, n, i) => {
  const o = e.children[t], a = o.rExt, c = e.children[t - 1];
  a.rThr = n;
  const s = i - n.relX - o.rExtRelX;
  a.relX += s, a.prelim -= s, o.rExt = c.rExt, o.rExtRelX = c.rExtRelX;
}, me = (e) => {
  if (e.hasChildren) {
    const t = e.firstChild, n = e.lastChild, i = (t.prelim + t.relX - t.xSize / 2 + n.relX + n.prelim + n.xSize / 2) / 2;
    Object.assign(e, {
      prelim: i,
      lExt: t.lExt,
      lExtRelX: t.lExtRelX,
      rExt: n.rExt,
      rExtRelX: n.rExtRelX
    });
  }
}, ge = (e, t, n) => {
  for (; n !== null && e >= n.lowY; )
    n = n.next;
  return {
    lowY: e,
    index: t,
    next: n
  };
}, xe = ".markmap-container{position:absolute;width:0;height:0;top:-100px;left:-100px;overflow:hidden}.markmap-container>.markmap-foreign{display:inline-block}.markmap-container>.markmap-foreign>div:last-child,.markmap-container>.markmap-foreign>div:last-child :not(pre){white-space:nowrap}.markmap-container>.markmap-foreign>div:last-child code{white-space:inherit}", tt = ".markmap{--markmap-max-width: none;--markmap-a-color: #0097e6;--markmap-a-hover-color: #00a8ff;--markmap-code-bg: #f0f0f0;--markmap-code-color: #555;--markmap-highlight-bg: #ffeaa7;--markmap-table-border: 1px solid currentColor;--markmap-font: 300 16px/20px sans-serif;font:var(--markmap-font)}.markmap-link{fill:none}.markmap-node>circle{cursor:pointer}.markmap-foreign{display:inline-block}.markmap-foreign a{color:var(--markmap-a-color)}.markmap-foreign a:hover{color:var(--markmap-a-hover-color)}.markmap-foreign code{padding:.25em;font-size:calc(1em - 2px);color:var(--markmap-code-color);background-color:var(--markmap-code-bg);border-radius:2px}.markmap-foreign pre{margin:0}.markmap-foreign pre>code{display:block}.markmap-foreign del{text-decoration:line-through}.markmap-foreign em{font-style:italic}.markmap-foreign strong{font-weight:700}.markmap-foreign mark{background:var(--markmap-highlight-bg)}.markmap-foreign table,.markmap-foreign th,.markmap-foreign td{border-collapse:collapse;border:var(--markmap-table-border)}.markmap-foreign img{display:inline-block}.markmap-foreign-testing-max{max-width:var(--markmap-max-width)}.markmap-foreign-testing-max img{max-width:var(--markmap-max-width);max-height:none}", be = tt;
function W(e) {
  const t = e.data;
  return Math.max(4 - 2 * t.state.depth, 1.5);
}
function Y(e, t) {
  const n = mt(e, t);
  return e[n];
}
function D(e) {
  e.stopPropagation();
}
const ye = new st();
class et {
  constructor(t, n) {
    this.options = P, this.revokers = [], this.imgCache = {}, this.handleZoom = (i) => {
      const { transform: o } = i;
      this.g.attr("transform", o);
    }, this.handlePan = (i) => {
      i.preventDefault();
      const o = A(this.svg.node()), a = o.translate(
        -i.deltaX / o.k,
        -i.deltaY / o.k
      );
      this.svg.call(this.zoom.transform, a);
    }, this.handleClick = (i, o) => {
      let a = this.options.toggleRecursively;
      (K ? i.metaKey : i.ctrlKey) && (a = !a), this.toggleNode(o.data, a);
    }, this.svg = t.datum ? t : dt(t), this.styleNode = this.svg.append("style"), this.zoom = ut().filter((i) => this.options.scrollForPan && i.type === "wheel" ? i.ctrlKey && !i.button : (!i.ctrlKey || i.type === "wheel") && !i.button).on("zoom", this.handleZoom), this.setOptions(n), this.state = {
      id: this.options.id || this.svg.attr("id") || at(),
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0
    }, this.g = this.svg.append("g"), this.debouncedRefresh = lt(() => this.setData(), 200), this.revokers.push(
      ye.tap(() => {
        this.setData();
      })
    );
  }
  getStyleContent() {
    const { style: t } = this.options, { id: n } = this.state, i = typeof t == "function" ? t(n) : "";
    return [this.options.embedGlobalCSS && tt, i].filter(Boolean).join(`
`);
  }
  updateStyle() {
    this.svg.attr(
      "class",
      ct(this.svg.attr("class"), "markmap", this.state.id)
    );
    const t = this.getStyleContent();
    this.styleNode.text(t);
  }
  toggleNode(t, n = !1) {
    var o, a;
    const i = (o = t.payload) != null && o.fold ? 0 : 1;
    n ? T(t, (c, s) => {
      c.payload = {
        ...c.payload,
        fold: i
      }, s();
    }) : t.payload = {
      ...t.payload,
      fold: (a = t.payload) != null && a.fold ? 0 : 1
    }, this.renderData(t);
  }
  initializeData(t) {
    let n = 0;
    const { color: i, nodeMinHeight: o, maxWidth: a, initialExpandLevel: c } = this.options, { id: s } = this.state, l = O(
      /* @__PURE__ */ j("div", { className: `markmap-container markmap ${s}-g` })
    ), p = O(
      /* @__PURE__ */ j("style", { children: [this.getStyleContent(), xe].join(`
`) })
    );
    document.body.append(l, p);
    const h = a ? `--markmap-max-width: ${a}px` : "";
    let u = 0, g = 0;
    T(t, (f, y, m) => {
      var b, w, z;
      g += 1, f.children = (b = f.children) == null ? void 0 : b.map((E) => ({ ...E })), n += 1;
      const k = O(
        /* @__PURE__ */ j(
          "div",
          {
            className: "markmap-foreign markmap-foreign-testing-max",
            style: h,
            children: /* @__PURE__ */ j("div", { dangerouslySetInnerHTML: { __html: f.content } })
          }
        )
      );
      l.append(k), f.state = {
        ...f.state,
        depth: g,
        id: n,
        el: k.firstChild
      }, f.state.path = [(w = m == null ? void 0 : m.state) == null ? void 0 : w.path, f.state.id].filter(Boolean).join("."), i(f);
      const v = ((z = f.payload) == null ? void 0 : z.fold) === 2;
      v ? u += 1 : (u || c >= 0 && f.state.depth >= c) && (f.payload = { ...f.payload, fold: 1 }), y(), v && (u -= 1), g -= 1;
    });
    const x = Array.from(l.childNodes).map(
      (f) => f.firstChild
    );
    this._checkImages(l), x.forEach((f) => {
      var y;
      (y = f.parentNode) == null || y.append(f.cloneNode(!0));
    }), T(t, (f, y, m) => {
      var b;
      const k = f.state, v = k.el.getBoundingClientRect();
      f.content = k.el.innerHTML, k.size = [
        Math.ceil(v.width) + 1,
        Math.max(Math.ceil(v.height), o)
      ], k.key = [(b = m == null ? void 0 : m.state) == null ? void 0 : b.id, k.id].filter(Boolean).join(".") + // FIXME: find a way to check content hash
      f.content, y();
    }), l.remove(), p.remove();
  }
  _checkImages(t) {
    t.querySelectorAll("img").forEach((n) => {
      if (n.width)
        return;
      const i = this.imgCache[n.src];
      i != null && i[0] ? [n.width, n.height] = i : i || this._loadImage(n.src);
    });
  }
  _loadImage(t) {
    this.imgCache[t] = [0, 0];
    const n = new Image();
    n.src = t, n.onload = () => {
      this.imgCache[t] = [n.naturalWidth, n.naturalHeight], this.debouncedRefresh();
    };
  }
  setOptions(t) {
    this.options = {
      ...this.options,
      ...t
    }, this.options.zoom ? this.svg.call(this.zoom) : this.svg.on(".zoom", null), this.options.pan ? this.svg.on("wheel", this.handlePan) : this.svg.on("wheel", null);
  }
  setData(t, n) {
    n && this.setOptions(n), t && (this.state.data = t), this.state.data && (this.initializeData(this.state.data), this.updateStyle(), this.renderData());
  }
  renderData(t) {
    if (!this.state.data)
      return;
    const { spacingHorizontal: n, paddingX: i, spacingVertical: o, autoFit: a, color: c } = this.options, s = q({}).children((r) => {
      var d;
      if (!((d = r.payload) != null && d.fold))
        return r.children;
    }).nodeSize((r) => {
      const [d, S] = r.data.state.size;
      return [S, d + (d ? i * 2 : 0) + n];
    }).spacing((r, d) => r.parent === d.parent ? o : o * 2), l = s.hierarchy(this.state.data);
    s(l);
    const p = l.descendants().reverse(), h = l.links(), u = pt(), g = H(p, (r) => r.x - r.xSize / 2), x = L(p, (r) => r.x + r.xSize / 2), f = H(p, (r) => r.y), y = L(p, (r) => r.y + r.ySize - n);
    Object.assign(this.state, {
      minX: g,
      maxX: x,
      minY: f,
      maxY: y
    }), a && this.fit();
    const m = t && p.find((r) => r.data === t) || l, k = m.data.state.x0 ?? m.x, v = m.data.state.y0 ?? m.y, b = this.g.selectAll(
      C("g")
    ).data(p, (r) => r.data.state.key), w = b.enter().append("g").attr("data-depth", (r) => r.data.state.depth).attr("data-path", (r) => r.data.state.path).attr(
      "transform",
      (r) => `translate(${v + m.ySize - r.ySize},${k + m.xSize / 2 - r.xSize})`
    ), z = this.transition(b.exit());
    z.select("line").attr("x1", (r) => r.ySize - n).attr("x2", (r) => r.ySize - n), z.select("foreignObject").style("opacity", 0), z.attr(
      "transform",
      (r) => `translate(${m.y + m.ySize - r.ySize},${m.x + m.xSize / 2 - r.xSize})`
    ).remove();
    const E = b.merge(w).attr(
      "class",
      (r) => {
        var d;
        return ["markmap-node", ((d = r.data.payload) == null ? void 0 : d.fold) && "markmap-fold"].filter(Boolean).join(" ");
      }
    );
    this.transition(E).attr(
      "transform",
      (r) => `translate(${r.y},${r.x - r.xSize / 2})`
    );
    const nt = E.selectAll(
      C("line")
    ).data(
      (r) => [r],
      (r) => r.data.state.key
    ).join(
      (r) => r.append("line").attr("x1", (d) => d.ySize - n).attr("x2", (d) => d.ySize - n),
      (r) => r,
      (r) => r.remove()
    );
    this.transition(nt).attr("x1", -1).attr("x2", (r) => r.ySize - n + 2).attr("y1", (r) => r.xSize).attr("y2", (r) => r.xSize).attr("stroke", (r) => c(r.data)).attr("stroke-width", W);
    const it = E.selectAll(
      C("circle")
    ).data(
      (r) => {
        var d;
        return (d = r.data.children) != null && d.length ? [r] : [];
      },
      (r) => r.data.state.key
    ).join(
      (r) => r.append("circle").attr("stroke-width", "1.5").attr("cx", (d) => d.ySize - n).attr("cy", (d) => d.xSize).attr("r", 0).on("click", (d, S) => this.handleClick(d, S)).on("mousedown", D),
      (r) => r,
      (r) => r.remove()
    );
    this.transition(it).attr("r", 6).attr("cx", (r) => r.ySize - n).attr("cy", (r) => r.xSize).attr("stroke", (r) => c(r.data)).attr(
      "fill",
      (r) => {
        var d;
        return (d = r.data.payload) != null && d.fold && r.data.children ? c(r.data) : "#fff";
      }
    );
    const rt = E.selectAll(
      C("foreignObject")
    ).data(
      (r) => [r],
      (r) => r.data.state.key
    ).join(
      (r) => {
        const d = r.append("foreignObject").attr("class", "markmap-foreign").attr("x", i).attr("y", 0).style("opacity", 0).on("mousedown", D).on("dblclick", D);
        return d.append("xhtml:div").select(function(R) {
          const X = R.data.state.el.cloneNode(!0);
          return this.replaceWith(X), X;
        }).attr("xmlns", "http://www.w3.org/1999/xhtml"), d;
      },
      (r) => r,
      (r) => r.remove()
    ).attr(
      "width",
      (r) => Math.max(0, r.ySize - n - i * 2)
    ).attr("height", (r) => r.xSize);
    this.transition(rt).style("opacity", 1);
    const ot = this.g.selectAll(
      C("path")
    ).data(h, (r) => r.target.data.state.key).join(
      (r) => {
        const d = [
          v + m.ySize - n,
          k + m.xSize / 2
        ];
        return r.insert("path", "g").attr("class", "markmap-link").attr("data-depth", (S) => S.target.data.state.depth).attr("data-path", (S) => S.target.data.state.path).attr("d", u({ source: d, target: d }));
      },
      (r) => r,
      (r) => {
        const d = [
          m.y + m.ySize - n,
          m.x + m.xSize / 2
        ];
        return this.transition(r).attr("d", u({ source: d, target: d })).remove();
      }
    );
    this.transition(ot).attr("stroke", (r) => c(r.target.data)).attr("stroke-width", (r) => W(r.target)).attr("d", (r) => {
      const d = r.source, S = r.target, R = [
        d.y + d.ySize - n,
        d.x + d.xSize / 2
      ], X = [
        S.y,
        S.x + S.xSize / 2
      ];
      return u({ source: R, target: X });
    }), p.forEach((r) => {
      r.data.state.x0 = r.x, r.data.state.y0 = r.y;
    });
  }
  transition(t) {
    const { duration: n } = this.options;
    return t.transition().duration(n);
  }
  /**
   * Fit the content to the viewport.
   */
  async fit() {
    const t = this.svg.node(), { width: n, height: i } = t.getBoundingClientRect(), { fitRatio: o } = this.options, { minX: a, maxX: c, minY: s, maxY: l } = this.state, p = l - s, h = c - a, u = Math.min(
      n / p * o,
      i / h * o,
      2
    ), g = ft.translate(
      (n - p * u) / 2 - s * u,
      (i - h * u) / 2 - a * u
    ).scale(u);
    return this.transition(this.svg).call(this.zoom.transform, g).end().catch(M);
  }
  findElement(t) {
    let n;
    return this.g.selectAll(
      C("g")
    ).each(function(o) {
      o.data === t && (n = {
        data: o,
        g: this
      });
    }), n;
  }
  /**
   * Pan the content to make the provided node visible in the viewport.
   */
  async ensureView(t, n) {
    var k;
    const i = (k = this.findElement(t)) == null ? void 0 : k.data;
    if (!i)
      return;
    const o = this.svg.node(), { spacingHorizontal: a } = this.options, c = o.getBoundingClientRect(), s = A(o), [l, p] = [
      i.y,
      i.y + i.ySize - a + 2
    ].map((v) => v * s.k + s.x), [h, u] = [
      i.x - i.xSize / 2,
      i.x + i.xSize / 2
    ].map((v) => v * s.k + s.y), g = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      ...n
    }, x = [g.left - l, c.width - g.right - p], f = [g.top - h, c.height - g.bottom - u], y = x[0] * x[1] > 0 ? Y(x, Math.abs) / s.k : 0, m = f[0] * f[1] > 0 ? Y(f, Math.abs) / s.k : 0;
    if (y || m) {
      const v = s.translate(y, m);
      return this.transition(this.svg).call(this.zoom.transform, v).end().catch(M);
    }
  }
  /**
   * Scale content with it pinned at the center of the viewport.
   */
  async rescale(t) {
    const n = this.svg.node(), { width: i, height: o } = n.getBoundingClientRect(), a = i / 2, c = o / 2, s = A(n), l = s.translate(
      (a - s.x) * (1 - t) / s.k,
      (c - s.y) * (1 - t) / s.k
    ).scale(t);
    return this.transition(this.svg).call(this.zoom.transform, l).end().catch(M);
  }
  destroy() {
    this.svg.on(".zoom", null), this.svg.html(null), this.revokers.forEach((t) => {
      t();
    });
  }
  static create(t, n, i = null) {
    const o = new et(t, n);
    return i && (o.setData(i), o.fit()), o;
  }
}
export {
  et as Markmap,
  gt as defaultColorFn,
  P as defaultOptions,
  Se as deriveOptions,
  be as globalCSS,
  K as isMacintosh,
  Ce as loadCSS,
  we as loadJS,
  ye as refreshHook
};
