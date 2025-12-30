(function(exports, require$$0) {
  "use strict";
  const testPath = "npm2url/dist/index.cjs";
  const defaultProviders = {
    jsdelivr: (path) => `https://cdn.jsdelivr.net/npm/${path}`,
    unpkg: (path) => `https://unpkg.com/${path}`
  };
  async function checkUrl(url, signal) {
    const res = await fetch(url, {
      signal
    });
    if (!res.ok) {
      throw res;
    }
    await res.text();
  }
  class UrlBuilder {
    constructor() {
      this.providers = { ...defaultProviders };
      this.provider = "jsdelivr";
    }
    /**
     * Get the fastest provider name.
     * If none of the providers returns a valid response within `timeout`, an error will be thrown.
     */
    async getFastestProvider(timeout = 5e3, path = testPath) {
      const controller = new AbortController();
      let timer = 0;
      try {
        return await new Promise((resolve, reject) => {
          Promise.all(
            Object.entries(this.providers).map(async ([name2, factory]) => {
              try {
                await checkUrl(factory(path), controller.signal);
                resolve(name2);
              } catch {
              }
            })
          ).then(() => reject(new Error("All providers failed")));
          timer = setTimeout(reject, timeout, new Error("Timed out"));
        });
      } finally {
        controller.abort();
        clearTimeout(timer);
      }
    }
    /**
     * Set the current provider to the fastest provider found by `getFastestProvider`.
     */
    async findFastestProvider(timeout, path) {
      this.provider = await this.getFastestProvider(timeout, path);
      return this.provider;
    }
    setProvider(name2, factory) {
      if (factory) {
        this.providers[name2] = factory;
      } else {
        delete this.providers[name2];
      }
    }
    getFullUrl(path, provider = this.provider) {
      if (path.includes("://")) {
        return path;
      }
      const factory = this.providers[provider];
      if (!factory) {
        throw new Error(`Provider ${provider} not found`);
      }
      return factory(path);
    }
  }
  class Hook {
    constructor() {
      this.listeners = [];
    }
    tap(fn) {
      this.listeners.push(fn);
      return () => this.revoke(fn);
    }
    revoke(fn) {
      const i2 = this.listeners.indexOf(fn);
      if (i2 >= 0)
        this.listeners.splice(i2, 1);
    }
    revokeAll() {
      this.listeners.splice(0);
    }
    call(...args) {
      for (const fn of this.listeners) {
        fn(...args);
      }
    }
  }
  Math.random().toString(36).slice(2, 8);
  function noop() {
  }
  function walkTree(tree, callback) {
    const walk = (item, parent2) => callback(
      item,
      () => {
        var _a2;
        return (_a2 = item.children) == null ? void 0 : _a2.map((child) => walk(child, item));
      },
      parent2
    );
    return walk(tree);
  }
  function wrapFunction(fn, wrapper) {
    return (...args) => wrapper(fn, ...args);
  }
  function defer() {
    const obj = {};
    obj.promise = new Promise((resolve, reject) => {
      obj.resolve = resolve;
      obj.reject = reject;
    });
    return obj;
  }
  function memoize(fn) {
    const cache = {};
    return function memoized(...args) {
      const key = `${args[0]}`;
      let data2 = cache[key];
      if (!data2) {
        data2 = {
          value: fn(...args)
        };
        cache[key] = data2;
      }
      return data2.value;
    };
  }
  /*! @gera2ld/jsx-dom v2.2.2 | ISC License */
  const VTYPE_ELEMENT = 1;
  const VTYPE_FUNCTION = 2;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const NS_ATTRS = {
    show: XLINK_NS,
    actuate: XLINK_NS,
    href: XLINK_NS
  };
  const isLeaf = (c) => typeof c === "string" || typeof c === "number";
  const isElement = (c) => (c == null ? void 0 : c.vtype) === VTYPE_ELEMENT;
  const isRenderFunction = (c) => (c == null ? void 0 : c.vtype) === VTYPE_FUNCTION;
  function h(type2, props, ...children2) {
    props = Object.assign({}, props, {
      children: children2.length === 1 ? children2[0] : children2
    });
    return jsx(type2, props);
  }
  function jsx(type2, props) {
    let vtype;
    if (typeof type2 === "string")
      vtype = VTYPE_ELEMENT;
    else if (typeof type2 === "function")
      vtype = VTYPE_FUNCTION;
    else
      throw new Error("Invalid VNode type");
    return {
      vtype,
      type: type2,
      props
    };
  }
  function Fragment(props) {
    return props.children;
  }
  const DEFAULT_ENV = {
    isSvg: false
  };
  function insertDom(parent2, nodes) {
    if (!Array.isArray(nodes))
      nodes = [nodes];
    nodes = nodes.filter(Boolean);
    if (nodes.length)
      parent2.append(...nodes);
  }
  function mountAttributes(domElement, props, env) {
    for (const key in props) {
      if (key === "key" || key === "children" || key === "ref")
        continue;
      if (key === "dangerouslySetInnerHTML") {
        domElement.innerHTML = props[key].__html;
      } else if (key === "innerHTML" || key === "textContent" || key === "innerText" || key === "value" && ["textarea", "select"].includes(domElement.tagName)) {
        const value = props[key];
        if (value != null)
          domElement[key] = value;
      } else if (key.startsWith("on")) {
        domElement[key.toLowerCase()] = props[key];
      } else {
        setDOMAttribute(domElement, key, props[key], env.isSvg);
      }
    }
  }
  const attrMap = {
    className: "class",
    labelFor: "for"
  };
  function setDOMAttribute(el, attr2, value, isSVG) {
    attr2 = attrMap[attr2] || attr2;
    if (value === true) {
      el.setAttribute(attr2, "");
    } else if (value === false) {
      el.removeAttribute(attr2);
    } else {
      const namespace = isSVG ? NS_ATTRS[attr2] : void 0;
      if (namespace !== void 0) {
        el.setAttributeNS(namespace, attr2, value);
      } else {
        el.setAttribute(attr2, value);
      }
    }
  }
  function flatten$1(arr) {
    return arr.reduce((prev2, item) => prev2.concat(item), []);
  }
  function mountChildren(children2, env) {
    return Array.isArray(children2) ? flatten$1(children2.map((child) => mountChildren(child, env))) : mount(children2, env);
  }
  function mount(vnode, env = DEFAULT_ENV) {
    if (vnode == null || typeof vnode === "boolean") {
      return null;
    }
    if (vnode instanceof Node) {
      return vnode;
    }
    if (isRenderFunction(vnode)) {
      const {
        type: type2,
        props
      } = vnode;
      if (type2 === Fragment) {
        const node = document.createDocumentFragment();
        if (props.children) {
          const children2 = mountChildren(props.children, env);
          insertDom(node, children2);
        }
        return node;
      }
      const childVNode = type2(props);
      return mount(childVNode, env);
    }
    if (isLeaf(vnode)) {
      return document.createTextNode(`${vnode}`);
    }
    if (isElement(vnode)) {
      let node;
      const {
        type: type2,
        props
      } = vnode;
      if (!env.isSvg && type2 === "svg") {
        env = Object.assign({}, env, {
          isSvg: true
        });
      }
      if (!env.isSvg) {
        node = document.createElement(type2);
      } else {
        node = document.createElementNS(SVG_NS, type2);
      }
      mountAttributes(node, props, env);
      if (props.children) {
        let childEnv = env;
        if (env.isSvg && type2 === "foreignObject") {
          childEnv = Object.assign({}, childEnv, {
            isSvg: false
          });
        }
        const children2 = mountChildren(props.children, childEnv);
        if (children2 != null)
          insertDom(node, children2);
      }
      const {
        ref
      } = props;
      if (typeof ref === "function")
        ref(node);
      return node;
    }
    throw new Error("mount: Invalid Vnode!");
  }
  function mountDom(vnode) {
    return mount(vnode);
  }
  function hm(...args) {
    return mountDom(h(...args));
  }
  const memoizedPreloadJS = memoize((url) => {
    document.head.append(
      hm("link", {
        rel: "preload",
        as: "script",
        href: url
      })
    );
  });
  const jsCache = {};
  async function loadJSItem(item, context) {
    var _a2;
    const src = item.type === "script" && ((_a2 = item.data) == null ? void 0 : _a2.src) || "";
    item.loaded || (item.loaded = jsCache[src]);
    if (!item.loaded) {
      const deferred = defer();
      item.loaded = deferred.promise;
      if (item.type === "script") {
        document.head.append(
          hm("script", {
            ...item.data,
            onLoad: () => deferred.resolve(),
            onError: deferred.reject
          })
        );
        if (!src) {
          deferred.resolve();
        } else {
          jsCache[src] = item.loaded;
        }
      }
      if (item.type === "iife") {
        const { fn, getParams } = item.data;
        fn(...(getParams == null ? void 0 : getParams(context)) || []);
        deferred.resolve();
      }
    }
    await item.loaded;
  }
  async function loadJS(items, context) {
    items.forEach((item) => {
      var _a2;
      if (item.type === "script" && ((_a2 = item.data) == null ? void 0 : _a2.src)) {
        memoizedPreloadJS(item.data.src);
      }
    });
    context = {
      getMarkmap: () => window.markmap,
      ...context
    };
    for (const item of items) {
      await loadJSItem(item, context);
    }
  }
  function buildJSItem(path) {
    return {
      type: "script",
      data: {
        src: path
      }
    };
  }
  function buildCSSItem(path) {
    return {
      type: "stylesheet",
      data: {
        href: path
      }
    };
  }
  const defaultOpts$2 = {
    xml: false,
    decodeEntities: true
  };
  const xmlModeDefault = {
    _useHtmlParser2: true,
    xmlMode: true
  };
  function flatten(options) {
    return (options === null || options === void 0 ? void 0 : options.xml) ? typeof options.xml === "boolean" ? xmlModeDefault : { ...xmlModeDefault, ...options.xml } : options !== null && options !== void 0 ? options : void 0;
  }
  var ElementType;
  (function(ElementType2) {
    ElementType2["Root"] = "root";
    ElementType2["Text"] = "text";
    ElementType2["Directive"] = "directive";
    ElementType2["Comment"] = "comment";
    ElementType2["Script"] = "script";
    ElementType2["Style"] = "style";
    ElementType2["Tag"] = "tag";
    ElementType2["CDATA"] = "cdata";
    ElementType2["Doctype"] = "doctype";
  })(ElementType || (ElementType = {}));
  function isTag$1(elem) {
    return elem.type === ElementType.Tag || elem.type === ElementType.Script || elem.type === ElementType.Style;
  }
  const Root = ElementType.Root;
  const Text$1 = ElementType.Text;
  const Directive = ElementType.Directive;
  const Comment$1 = ElementType.Comment;
  const Script = ElementType.Script;
  const Style = ElementType.Style;
  const Tag = ElementType.Tag;
  const CDATA$1 = ElementType.CDATA;
  const Doctype = ElementType.Doctype;
  let Node$1 = class Node {
    constructor() {
      this.parent = null;
      this.prev = null;
      this.next = null;
      this.startIndex = null;
      this.endIndex = null;
    }
    // Read-write aliases for properties
    /**
     * Same as {@link parent}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get parentNode() {
      return this.parent;
    }
    set parentNode(parent2) {
      this.parent = parent2;
    }
    /**
     * Same as {@link prev}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get previousSibling() {
      return this.prev;
    }
    set previousSibling(prev2) {
      this.prev = prev2;
    }
    /**
     * Same as {@link next}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get nextSibling() {
      return this.next;
    }
    set nextSibling(next2) {
      this.next = next2;
    }
    /**
     * Clone this node, and optionally its children.
     *
     * @param recursive Clone child nodes as well.
     * @returns A clone of the node.
     */
    cloneNode(recursive = false) {
      return cloneNode(this, recursive);
    }
  };
  class DataNode extends Node$1 {
    /**
     * @param data The content of the data node
     */
    constructor(data2) {
      super();
      this.data = data2;
    }
    /**
     * Same as {@link data}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get nodeValue() {
      return this.data;
    }
    set nodeValue(data2) {
      this.data = data2;
    }
  }
  class Text extends DataNode {
    constructor() {
      super(...arguments);
      this.type = ElementType.Text;
    }
    get nodeType() {
      return 3;
    }
  }
  class Comment extends DataNode {
    constructor() {
      super(...arguments);
      this.type = ElementType.Comment;
    }
    get nodeType() {
      return 8;
    }
  }
  class ProcessingInstruction extends DataNode {
    constructor(name2, data2) {
      super(data2);
      this.name = name2;
      this.type = ElementType.Directive;
    }
    get nodeType() {
      return 1;
    }
  }
  class NodeWithChildren extends Node$1 {
    /**
     * @param children Children of the node. Only certain node types can have children.
     */
    constructor(children2) {
      super();
      this.children = children2;
    }
    // Aliases
    /** First child of the node. */
    get firstChild() {
      var _a2;
      return (_a2 = this.children[0]) !== null && _a2 !== void 0 ? _a2 : null;
    }
    /** Last child of the node. */
    get lastChild() {
      return this.children.length > 0 ? this.children[this.children.length - 1] : null;
    }
    /**
     * Same as {@link children}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get childNodes() {
      return this.children;
    }
    set childNodes(children2) {
      this.children = children2;
    }
  }
  class CDATA extends NodeWithChildren {
    constructor() {
      super(...arguments);
      this.type = ElementType.CDATA;
    }
    get nodeType() {
      return 4;
    }
  }
  class Document extends NodeWithChildren {
    constructor() {
      super(...arguments);
      this.type = ElementType.Root;
    }
    get nodeType() {
      return 9;
    }
  }
  class Element extends NodeWithChildren {
    /**
     * @param name Name of the tag, eg. `div`, `span`.
     * @param attribs Object mapping attribute names to attribute values.
     * @param children Children of the node.
     */
    constructor(name2, attribs, children2 = [], type2 = name2 === "script" ? ElementType.Script : name2 === "style" ? ElementType.Style : ElementType.Tag) {
      super(children2);
      this.name = name2;
      this.attribs = attribs;
      this.type = type2;
    }
    get nodeType() {
      return 1;
    }
    // DOM Level 1 aliases
    /**
     * Same as {@link name}.
     * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
     */
    get tagName() {
      return this.name;
    }
    set tagName(name2) {
      this.name = name2;
    }
    get attributes() {
      return Object.keys(this.attribs).map((name2) => {
        var _a2, _b;
        return {
          name: name2,
          value: this.attribs[name2],
          namespace: (_a2 = this["x-attribsNamespace"]) === null || _a2 === void 0 ? void 0 : _a2[name2],
          prefix: (_b = this["x-attribsPrefix"]) === null || _b === void 0 ? void 0 : _b[name2]
        };
      });
    }
  }
  function isTag(node) {
    return isTag$1(node);
  }
  function isCDATA(node) {
    return node.type === ElementType.CDATA;
  }
  function isText(node) {
    return node.type === ElementType.Text;
  }
  function isComment(node) {
    return node.type === ElementType.Comment;
  }
  function isDirective(node) {
    return node.type === ElementType.Directive;
  }
  function isDocument(node) {
    return node.type === ElementType.Root;
  }
  function hasChildren(node) {
    return Object.prototype.hasOwnProperty.call(node, "children");
  }
  function cloneNode(node, recursive = false) {
    let result;
    if (isText(node)) {
      result = new Text(node.data);
    } else if (isComment(node)) {
      result = new Comment(node.data);
    } else if (isTag(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new Element(node.name, { ...node.attribs }, children2);
      children2.forEach((child) => child.parent = clone2);
      if (node.namespace != null) {
        clone2.namespace = node.namespace;
      }
      if (node["x-attribsNamespace"]) {
        clone2["x-attribsNamespace"] = { ...node["x-attribsNamespace"] };
      }
      if (node["x-attribsPrefix"]) {
        clone2["x-attribsPrefix"] = { ...node["x-attribsPrefix"] };
      }
      result = clone2;
    } else if (isCDATA(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new CDATA(children2);
      children2.forEach((child) => child.parent = clone2);
      result = clone2;
    } else if (isDocument(node)) {
      const children2 = recursive ? cloneChildren(node.children) : [];
      const clone2 = new Document(children2);
      children2.forEach((child) => child.parent = clone2);
      if (node["x-mode"]) {
        clone2["x-mode"] = node["x-mode"];
      }
      result = clone2;
    } else if (isDirective(node)) {
      const instruction = new ProcessingInstruction(node.name, node.data);
      if (node["x-name"] != null) {
        instruction["x-name"] = node["x-name"];
        instruction["x-publicId"] = node["x-publicId"];
        instruction["x-systemId"] = node["x-systemId"];
      }
      result = instruction;
    } else {
      throw new Error(`Not implemented yet: ${node.type}`);
    }
    result.startIndex = node.startIndex;
    result.endIndex = node.endIndex;
    if (node.sourceCodeLocation != null) {
      result.sourceCodeLocation = node.sourceCodeLocation;
    }
    return result;
  }
  function cloneChildren(childs) {
    const children2 = childs.map((child) => cloneNode(child, true));
    for (let i2 = 1; i2 < children2.length; i2++) {
      children2[i2].prev = children2[i2 - 1];
      children2[i2 - 1].next = children2[i2];
    }
    return children2;
  }
  const defaultOpts$1 = {
    withStartIndices: false,
    withEndIndices: false,
    xmlMode: false
  };
  class DomHandler {
    /**
     * @param callback Called once parsing has completed.
     * @param options Settings for the handler.
     * @param elementCB Callback whenever a tag is closed.
     */
    constructor(callback, options, elementCB) {
      this.dom = [];
      this.root = new Document(this.dom);
      this.done = false;
      this.tagStack = [this.root];
      this.lastNode = null;
      this.parser = null;
      if (typeof options === "function") {
        elementCB = options;
        options = defaultOpts$1;
      }
      if (typeof callback === "object") {
        options = callback;
        callback = void 0;
      }
      this.callback = callback !== null && callback !== void 0 ? callback : null;
      this.options = options !== null && options !== void 0 ? options : defaultOpts$1;
      this.elementCB = elementCB !== null && elementCB !== void 0 ? elementCB : null;
    }
    onparserinit(parser) {
      this.parser = parser;
    }
    // Resets the handler back to starting state
    onreset() {
      this.dom = [];
      this.root = new Document(this.dom);
      this.done = false;
      this.tagStack = [this.root];
      this.lastNode = null;
      this.parser = null;
    }
    // Signals the handler that parsing is done
    onend() {
      if (this.done)
        return;
      this.done = true;
      this.parser = null;
      this.handleCallback(null);
    }
    onerror(error) {
      this.handleCallback(error);
    }
    onclosetag() {
      this.lastNode = null;
      const elem = this.tagStack.pop();
      if (this.options.withEndIndices) {
        elem.endIndex = this.parser.endIndex;
      }
      if (this.elementCB)
        this.elementCB(elem);
    }
    onopentag(name2, attribs) {
      const type2 = this.options.xmlMode ? ElementType.Tag : void 0;
      const element = new Element(name2, attribs, void 0, type2);
      this.addNode(element);
      this.tagStack.push(element);
    }
    ontext(data2) {
      const { lastNode } = this;
      if (lastNode && lastNode.type === ElementType.Text) {
        lastNode.data += data2;
        if (this.options.withEndIndices) {
          lastNode.endIndex = this.parser.endIndex;
        }
      } else {
        const node = new Text(data2);
        this.addNode(node);
        this.lastNode = node;
      }
    }
    oncomment(data2) {
      if (this.lastNode && this.lastNode.type === ElementType.Comment) {
        this.lastNode.data += data2;
        return;
      }
      const node = new Comment(data2);
      this.addNode(node);
      this.lastNode = node;
    }
    oncommentend() {
      this.lastNode = null;
    }
    oncdatastart() {
      const text2 = new Text("");
      const node = new CDATA([text2]);
      this.addNode(node);
      text2.parent = node;
      this.lastNode = text2;
    }
    oncdataend() {
      this.lastNode = null;
    }
    onprocessinginstruction(name2, data2) {
      const node = new ProcessingInstruction(name2, data2);
      this.addNode(node);
    }
    handleCallback(error) {
      if (typeof this.callback === "function") {
        this.callback(error, this.dom);
      } else if (error) {
        throw error;
      }
    }
    addNode(node) {
      const parent2 = this.tagStack[this.tagStack.length - 1];
      const previousSibling = parent2.children[parent2.children.length - 1];
      if (this.options.withStartIndices) {
        node.startIndex = this.parser.startIndex;
      }
      if (this.options.withEndIndices) {
        node.endIndex = this.parser.endIndex;
      }
      parent2.children.push(node);
      if (previousSibling) {
        node.prev = previousSibling;
        previousSibling.next = node;
      }
      node.parent = parent2;
      this.lastNode = null;
    }
  }
  const htmlDecodeTree = new Uint16Array(
    // prettier-ignore
    'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((c) => c.charCodeAt(0))
  );
  const xmlDecodeTree = new Uint16Array(
    // prettier-ignore
    "Ȁaglq	\x1Bɭ\0\0p;䀦os;䀧t;䀾t;䀼uot;䀢".split("").map((c) => c.charCodeAt(0))
  );
  var _a;
  const decodeMap = /* @__PURE__ */ new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376]
  ]);
  const fromCodePoint$1 = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
    (_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function(codePoint) {
      let output = "";
      if (codePoint > 65535) {
        codePoint -= 65536;
        output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
        codePoint = 56320 | codePoint & 1023;
      }
      output += String.fromCharCode(codePoint);
      return output;
    }
  );
  function replaceCodePoint(codePoint) {
    var _a2;
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return 65533;
    }
    return (_a2 = decodeMap.get(codePoint)) !== null && _a2 !== void 0 ? _a2 : codePoint;
  }
  var CharCodes$1;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
    CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
    CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
    CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
    CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
    CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
    CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
    CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
    CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
    CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
    CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
  })(CharCodes$1 || (CharCodes$1 = {}));
  const TO_LOWER_BIT = 32;
  var BinTrieFlags;
  (function(BinTrieFlags2) {
    BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  })(BinTrieFlags || (BinTrieFlags = {}));
  function isNumber$1(code2) {
    return code2 >= CharCodes$1.ZERO && code2 <= CharCodes$1.NINE;
  }
  function isHexadecimalCharacter(code2) {
    return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_F || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_F;
  }
  function isAsciiAlphaNumeric$1(code2) {
    return code2 >= CharCodes$1.UPPER_A && code2 <= CharCodes$1.UPPER_Z || code2 >= CharCodes$1.LOWER_A && code2 <= CharCodes$1.LOWER_Z || isNumber$1(code2);
  }
  function isEntityInAttributeInvalidEnd$1(code2) {
    return code2 === CharCodes$1.EQUALS || isAsciiAlphaNumeric$1(code2);
  }
  var EntityDecoderState;
  (function(EntityDecoderState2) {
    EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
  })(EntityDecoderState || (EntityDecoderState = {}));
  var DecodingMode;
  (function(DecodingMode2) {
    DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
    DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
    DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
  })(DecodingMode || (DecodingMode = {}));
  class EntityDecoder {
    constructor(decodeTree, emitCodePoint, errors) {
      this.decodeTree = decodeTree;
      this.emitCodePoint = emitCodePoint;
      this.errors = errors;
      this.state = EntityDecoderState.EntityStart;
      this.consumed = 1;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.decodeMode = DecodingMode.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
      this.decodeMode = decodeMode;
      this.state = EntityDecoderState.EntityStart;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param string The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(str2, offset) {
      switch (this.state) {
        case EntityDecoderState.EntityStart: {
          if (str2.charCodeAt(offset) === CharCodes$1.NUM) {
            this.state = EntityDecoderState.NumericStart;
            this.consumed += 1;
            return this.stateNumericStart(str2, offset + 1);
          }
          this.state = EntityDecoderState.NamedEntity;
          return this.stateNamedEntity(str2, offset);
        }
        case EntityDecoderState.NumericStart: {
          return this.stateNumericStart(str2, offset);
        }
        case EntityDecoderState.NumericDecimal: {
          return this.stateNumericDecimal(str2, offset);
        }
        case EntityDecoderState.NumericHex: {
          return this.stateNumericHex(str2, offset);
        }
        case EntityDecoderState.NamedEntity: {
          return this.stateNamedEntity(str2, offset);
        }
      }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(str2, offset) {
      if (offset >= str2.length) {
        return -1;
      }
      if ((str2.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes$1.LOWER_X) {
        this.state = EntityDecoderState.NumericHex;
        this.consumed += 1;
        return this.stateNumericHex(str2, offset + 1);
      }
      this.state = EntityDecoderState.NumericDecimal;
      return this.stateNumericDecimal(str2, offset);
    }
    addToNumericResult(str2, start, end2, base) {
      if (start !== end2) {
        const digitCount = end2 - start;
        this.result = this.result * Math.pow(base, digitCount) + parseInt(str2.substr(start, digitCount), base);
        this.consumed += digitCount;
      }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(str2, offset) {
      const startIdx = offset;
      while (offset < str2.length) {
        const char = str2.charCodeAt(offset);
        if (isNumber$1(char) || isHexadecimalCharacter(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str2, startIdx, offset, 16);
          return this.emitNumericEntity(char, 3);
        }
      }
      this.addToNumericResult(str2, startIdx, offset, 16);
      return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(str2, offset) {
      const startIdx = offset;
      while (offset < str2.length) {
        const char = str2.charCodeAt(offset);
        if (isNumber$1(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(str2, startIdx, offset, 10);
          return this.emitNumericEntity(char, 2);
        }
      }
      this.addToNumericResult(str2, startIdx, offset, 10);
      return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
      var _a2;
      if (this.consumed <= expectedLength) {
        (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      if (lastCp === CharCodes$1.SEMI) {
        this.consumed += 1;
      } else if (this.decodeMode === DecodingMode.Strict) {
        return 0;
      }
      this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
      if (this.errors) {
        if (lastCp !== CharCodes$1.SEMI) {
          this.errors.missingSemicolonAfterCharacterReference();
        }
        this.errors.validateNumericCharacterReference(this.result);
      }
      return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param str The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(str2, offset) {
      const { decodeTree } = this;
      let current = decodeTree[this.treeIndex];
      let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      for (; offset < str2.length; offset++, this.excess++) {
        const char = str2.charCodeAt(offset);
        this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
        if (this.treeIndex < 0) {
          return this.result === 0 || // If we are parsing an attribute
          this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
          (valueLength === 0 || // And there should be no invalid characters.
          isEntityInAttributeInvalidEnd$1(char)) ? 0 : this.emitNotTerminatedNamedEntity();
        }
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
        if (valueLength !== 0) {
          if (char === CharCodes$1.SEMI) {
            return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
          }
          if (this.decodeMode !== DecodingMode.Strict) {
            this.result = this.treeIndex;
            this.consumed += this.excess;
            this.excess = 0;
          }
        }
      }
      return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
      var _a2;
      const { result, decodeTree } = this;
      const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
      this.emitNamedEntityData(result, valueLength, this.consumed);
      (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.missingSemicolonAfterCharacterReference();
      return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
      const { decodeTree } = this;
      this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH : decodeTree[result + 1], consumed);
      if (valueLength === 3) {
        this.emitCodePoint(decodeTree[result + 2], consumed);
      }
      return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
      var _a2;
      switch (this.state) {
        case EntityDecoderState.NamedEntity: {
          return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
        }
        case EntityDecoderState.NumericDecimal: {
          return this.emitNumericEntity(0, 2);
        }
        case EntityDecoderState.NumericHex: {
          return this.emitNumericEntity(0, 3);
        }
        case EntityDecoderState.NumericStart: {
          (_a2 = this.errors) === null || _a2 === void 0 ? void 0 : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed);
          return 0;
        }
        case EntityDecoderState.EntityStart: {
          return 0;
        }
      }
    }
  }
  function getDecoder(decodeTree) {
    let ret = "";
    const decoder = new EntityDecoder(decodeTree, (str2) => ret += fromCodePoint$1(str2));
    return function decodeWithTrie(str2, decodeMode) {
      let lastIndex = 0;
      let offset = 0;
      while ((offset = str2.indexOf("&", offset)) >= 0) {
        ret += str2.slice(lastIndex, offset);
        decoder.startEntity(decodeMode);
        const len = decoder.write(
          str2,
          // Skip the "&"
          offset + 1
        );
        if (len < 0) {
          lastIndex = offset + decoder.end();
          break;
        }
        lastIndex = offset + len;
        offset = len === 0 ? lastIndex + 1 : lastIndex;
      }
      const result = ret + str2.slice(lastIndex);
      ret = "";
      return result;
    };
  }
  function determineBranch(decodeTree, current, nodeIdx, char) {
    const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
    if (branchCount === 0) {
      return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
    }
    if (jumpOffset) {
      const value = char - jumpOffset;
      return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIdx + value] - 1;
    }
    let lo = nodeIdx;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
      const mid = lo + hi >>> 1;
      const midVal = decodeTree[mid];
      if (midVal < char) {
        lo = mid + 1;
      } else if (midVal > char) {
        hi = mid - 1;
      } else {
        return decodeTree[mid + branchCount];
      }
    }
    return -1;
  }
  getDecoder(htmlDecodeTree);
  getDecoder(xmlDecodeTree);
  const xmlReplacer = /["&'<>$\x80-\uFFFF]/g;
  const xmlCodeMap = /* @__PURE__ */ new Map([
    [34, "&quot;"],
    [38, "&amp;"],
    [39, "&apos;"],
    [60, "&lt;"],
    [62, "&gt;"]
  ]);
  const getCodePoint = (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.prototype.codePointAt != null ? (str2, index2) => str2.codePointAt(index2) : (
      // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      (c, index2) => (c.charCodeAt(index2) & 64512) === 55296 ? (c.charCodeAt(index2) - 55296) * 1024 + c.charCodeAt(index2 + 1) - 56320 + 65536 : c.charCodeAt(index2)
    )
  );
  function encodeXML(str2) {
    let ret = "";
    let lastIdx = 0;
    let match;
    while ((match = xmlReplacer.exec(str2)) !== null) {
      const i2 = match.index;
      const char = str2.charCodeAt(i2);
      const next2 = xmlCodeMap.get(char);
      if (next2 !== void 0) {
        ret += str2.substring(lastIdx, i2) + next2;
        lastIdx = i2 + 1;
      } else {
        ret += `${str2.substring(lastIdx, i2)}&#x${getCodePoint(str2, i2).toString(16)};`;
        lastIdx = xmlReplacer.lastIndex += Number((char & 64512) === 55296);
      }
    }
    return ret + str2.substr(lastIdx);
  }
  function getEscaper(regex, map2) {
    return function escape2(data2) {
      let match;
      let lastIdx = 0;
      let result = "";
      while (match = regex.exec(data2)) {
        if (lastIdx !== match.index) {
          result += data2.substring(lastIdx, match.index);
        }
        result += map2.get(match[0].charCodeAt(0));
        lastIdx = match.index + 1;
      }
      return result + data2.substring(lastIdx);
    };
  }
  const escapeAttribute = getEscaper(/["&\u00A0]/g, /* @__PURE__ */ new Map([
    [34, "&quot;"],
    [38, "&amp;"],
    [160, "&nbsp;"]
  ]));
  const escapeText = getEscaper(/[&<>\u00A0]/g, /* @__PURE__ */ new Map([
    [38, "&amp;"],
    [60, "&lt;"],
    [62, "&gt;"],
    [160, "&nbsp;"]
  ]));
  const elementNames = new Map([
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath"
  ].map((val2) => [val2.toLowerCase(), val2]));
  const attributeNames = new Map([
    "definitionURL",
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan"
  ].map((val2) => [val2.toLowerCase(), val2]));
  const unencodedElements = /* @__PURE__ */ new Set([
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
    "noscript"
  ]);
  function replaceQuotes(value) {
    return value.replace(/"/g, "&quot;");
  }
  function formatAttributes(attributes2, opts) {
    var _a2;
    if (!attributes2)
      return;
    const encode = ((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) === false ? replaceQuotes : opts.xmlMode || opts.encodeEntities !== "utf8" ? encodeXML : escapeAttribute;
    return Object.keys(attributes2).map((key) => {
      var _a3, _b;
      const value = (_a3 = attributes2[key]) !== null && _a3 !== void 0 ? _a3 : "";
      if (opts.xmlMode === "foreign") {
        key = (_b = attributeNames.get(key)) !== null && _b !== void 0 ? _b : key;
      }
      if (!opts.emptyAttrs && !opts.xmlMode && value === "") {
        return key;
      }
      return `${key}="${encode(value)}"`;
    }).join(" ");
  }
  const singleTag = /* @__PURE__ */ new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  function render$1(node, options = {}) {
    const nodes = "length" in node ? node : [node];
    let output = "";
    for (let i2 = 0; i2 < nodes.length; i2++) {
      output += renderNode(nodes[i2], options);
    }
    return output;
  }
  function renderNode(node, options) {
    switch (node.type) {
      case Root:
        return render$1(node.children, options);
      case Doctype:
      case Directive:
        return renderDirective(node);
      case Comment$1:
        return renderComment(node);
      case CDATA$1:
        return renderCdata(node);
      case Script:
      case Style:
      case Tag:
        return renderTag(node, options);
      case Text$1:
        return renderText(node, options);
    }
  }
  const foreignModeIntegrationPoints = /* @__PURE__ */ new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignObject",
    "desc",
    "title"
  ]);
  const foreignElements = /* @__PURE__ */ new Set(["svg", "math"]);
  function renderTag(elem, opts) {
    var _a2;
    if (opts.xmlMode === "foreign") {
      elem.name = (_a2 = elementNames.get(elem.name)) !== null && _a2 !== void 0 ? _a2 : elem.name;
      if (elem.parent && foreignModeIntegrationPoints.has(elem.parent.name)) {
        opts = { ...opts, xmlMode: false };
      }
    }
    if (!opts.xmlMode && foreignElements.has(elem.name)) {
      opts = { ...opts, xmlMode: "foreign" };
    }
    let tag = `<${elem.name}`;
    const attribs = formatAttributes(elem.attribs, opts);
    if (attribs) {
      tag += ` ${attribs}`;
    }
    if (elem.children.length === 0 && (opts.xmlMode ? (
      // In XML mode or foreign mode, and user hasn't explicitly turned off self-closing tags
      opts.selfClosingTags !== false
    ) : (
      // User explicitly asked for self-closing tags, even in HTML mode
      opts.selfClosingTags && singleTag.has(elem.name)
    ))) {
      if (!opts.xmlMode)
        tag += " ";
      tag += "/>";
    } else {
      tag += ">";
      if (elem.children.length > 0) {
        tag += render$1(elem.children, opts);
      }
      if (opts.xmlMode || !singleTag.has(elem.name)) {
        tag += `</${elem.name}>`;
      }
    }
    return tag;
  }
  function renderDirective(elem) {
    return `<${elem.data}>`;
  }
  function renderText(elem, opts) {
    var _a2;
    let data2 = elem.data || "";
    if (((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) !== false && !(!opts.xmlMode && elem.parent && unencodedElements.has(elem.parent.name))) {
      data2 = opts.xmlMode || opts.encodeEntities !== "utf8" ? encodeXML(data2) : escapeText(data2);
    }
    return data2;
  }
  function renderCdata(elem) {
    return `<![CDATA[${elem.children[0].data}]]>`;
  }
  function renderComment(elem) {
    return `<!--${elem.data}-->`;
  }
  function getOuterHTML(node, options) {
    return render$1(node, options);
  }
  function getInnerHTML(node, options) {
    return hasChildren(node) ? node.children.map((node2) => getOuterHTML(node2, options)).join("") : "";
  }
  function getText(node) {
    if (Array.isArray(node))
      return node.map(getText).join("");
    if (isTag(node))
      return node.name === "br" ? "\n" : getText(node.children);
    if (isCDATA(node))
      return getText(node.children);
    if (isText(node))
      return node.data;
    return "";
  }
  function textContent(node) {
    if (Array.isArray(node))
      return node.map(textContent).join("");
    if (hasChildren(node) && !isComment(node)) {
      return textContent(node.children);
    }
    if (isText(node))
      return node.data;
    return "";
  }
  function innerText(node) {
    if (Array.isArray(node))
      return node.map(innerText).join("");
    if (hasChildren(node) && (node.type === ElementType.Tag || isCDATA(node))) {
      return innerText(node.children);
    }
    if (isText(node))
      return node.data;
    return "";
  }
  function getChildren(elem) {
    return hasChildren(elem) ? elem.children : [];
  }
  function getParent(elem) {
    return elem.parent || null;
  }
  function getSiblings(elem) {
    const parent2 = getParent(elem);
    if (parent2 != null)
      return getChildren(parent2);
    const siblings2 = [elem];
    let { prev: prev2, next: next2 } = elem;
    while (prev2 != null) {
      siblings2.unshift(prev2);
      ({ prev: prev2 } = prev2);
    }
    while (next2 != null) {
      siblings2.push(next2);
      ({ next: next2 } = next2);
    }
    return siblings2;
  }
  function getAttributeValue(elem, name2) {
    var _a2;
    return (_a2 = elem.attribs) === null || _a2 === void 0 ? void 0 : _a2[name2];
  }
  function hasAttrib(elem, name2) {
    return elem.attribs != null && Object.prototype.hasOwnProperty.call(elem.attribs, name2) && elem.attribs[name2] != null;
  }
  function getName(elem) {
    return elem.name;
  }
  function nextElementSibling(elem) {
    let { next: next2 } = elem;
    while (next2 !== null && !isTag(next2))
      ({ next: next2 } = next2);
    return next2;
  }
  function prevElementSibling(elem) {
    let { prev: prev2 } = elem;
    while (prev2 !== null && !isTag(prev2))
      ({ prev: prev2 } = prev2);
    return prev2;
  }
  function removeElement(elem) {
    if (elem.prev)
      elem.prev.next = elem.next;
    if (elem.next)
      elem.next.prev = elem.prev;
    if (elem.parent) {
      const childs = elem.parent.children;
      const childsIndex = childs.lastIndexOf(elem);
      if (childsIndex >= 0) {
        childs.splice(childsIndex, 1);
      }
    }
    elem.next = null;
    elem.prev = null;
    elem.parent = null;
  }
  function replaceElement(elem, replacement) {
    const prev2 = replacement.prev = elem.prev;
    if (prev2) {
      prev2.next = replacement;
    }
    const next2 = replacement.next = elem.next;
    if (next2) {
      next2.prev = replacement;
    }
    const parent2 = replacement.parent = elem.parent;
    if (parent2) {
      const childs = parent2.children;
      childs[childs.lastIndexOf(elem)] = replacement;
      elem.parent = null;
    }
  }
  function appendChild(parent2, child) {
    removeElement(child);
    child.next = null;
    child.parent = parent2;
    if (parent2.children.push(child) > 1) {
      const sibling = parent2.children[parent2.children.length - 2];
      sibling.next = child;
      child.prev = sibling;
    } else {
      child.prev = null;
    }
  }
  function append$1(elem, next2) {
    removeElement(next2);
    const { parent: parent2 } = elem;
    const currNext = elem.next;
    next2.next = currNext;
    next2.prev = elem;
    elem.next = next2;
    next2.parent = parent2;
    if (currNext) {
      currNext.prev = next2;
      if (parent2) {
        const childs = parent2.children;
        childs.splice(childs.lastIndexOf(currNext), 0, next2);
      }
    } else if (parent2) {
      parent2.children.push(next2);
    }
  }
  function prependChild(parent2, child) {
    removeElement(child);
    child.parent = parent2;
    child.prev = null;
    if (parent2.children.unshift(child) !== 1) {
      const sibling = parent2.children[1];
      sibling.prev = child;
      child.next = sibling;
    } else {
      child.next = null;
    }
  }
  function prepend$1(elem, prev2) {
    removeElement(prev2);
    const { parent: parent2 } = elem;
    if (parent2) {
      const childs = parent2.children;
      childs.splice(childs.indexOf(elem), 0, prev2);
    }
    if (elem.prev) {
      elem.prev.next = prev2;
    }
    prev2.parent = parent2;
    prev2.prev = elem.prev;
    prev2.next = elem;
    elem.prev = prev2;
  }
  function filter$2(test, node, recurse = true, limit = Infinity) {
    return find$2(test, Array.isArray(node) ? node : [node], recurse, limit);
  }
  function find$2(test, nodes, recurse, limit) {
    const result = [];
    const nodeStack = [nodes];
    const indexStack = [0];
    for (; ; ) {
      if (indexStack[0] >= nodeStack[0].length) {
        if (indexStack.length === 1) {
          return result;
        }
        nodeStack.shift();
        indexStack.shift();
        continue;
      }
      const elem = nodeStack[0][indexStack[0]++];
      if (test(elem)) {
        result.push(elem);
        if (--limit <= 0)
          return result;
      }
      if (recurse && hasChildren(elem) && elem.children.length > 0) {
        indexStack.unshift(0);
        nodeStack.unshift(elem.children);
      }
    }
  }
  function findOneChild(test, nodes) {
    return nodes.find(test);
  }
  function findOne(test, nodes, recurse = true) {
    let elem = null;
    for (let i2 = 0; i2 < nodes.length && !elem; i2++) {
      const node = nodes[i2];
      if (!isTag(node)) {
        continue;
      } else if (test(node)) {
        elem = node;
      } else if (recurse && node.children.length > 0) {
        elem = findOne(test, node.children, true);
      }
    }
    return elem;
  }
  function existsOne(test, nodes) {
    return nodes.some((checked) => isTag(checked) && (test(checked) || existsOne(test, checked.children)));
  }
  function findAll(test, nodes) {
    const result = [];
    const nodeStack = [nodes];
    const indexStack = [0];
    for (; ; ) {
      if (indexStack[0] >= nodeStack[0].length) {
        if (nodeStack.length === 1) {
          return result;
        }
        nodeStack.shift();
        indexStack.shift();
        continue;
      }
      const elem = nodeStack[0][indexStack[0]++];
      if (!isTag(elem))
        continue;
      if (test(elem))
        result.push(elem);
      if (elem.children.length > 0) {
        indexStack.unshift(0);
        nodeStack.unshift(elem.children);
      }
    }
  }
  const Checks = {
    tag_name(name2) {
      if (typeof name2 === "function") {
        return (elem) => isTag(elem) && name2(elem.name);
      } else if (name2 === "*") {
        return isTag;
      }
      return (elem) => isTag(elem) && elem.name === name2;
    },
    tag_type(type2) {
      if (typeof type2 === "function") {
        return (elem) => type2(elem.type);
      }
      return (elem) => elem.type === type2;
    },
    tag_contains(data2) {
      if (typeof data2 === "function") {
        return (elem) => isText(elem) && data2(elem.data);
      }
      return (elem) => isText(elem) && elem.data === data2;
    }
  };
  function getAttribCheck(attrib, value) {
    if (typeof value === "function") {
      return (elem) => isTag(elem) && value(elem.attribs[attrib]);
    }
    return (elem) => isTag(elem) && elem.attribs[attrib] === value;
  }
  function combineFuncs(a, b) {
    return (elem) => a(elem) || b(elem);
  }
  function compileTest(options) {
    const funcs = Object.keys(options).map((key) => {
      const value = options[key];
      return Object.prototype.hasOwnProperty.call(Checks, key) ? Checks[key](value) : getAttribCheck(key, value);
    });
    return funcs.length === 0 ? null : funcs.reduce(combineFuncs);
  }
  function testElement(options, node) {
    const test = compileTest(options);
    return test ? test(node) : true;
  }
  function getElements(options, nodes, recurse, limit = Infinity) {
    const test = compileTest(options);
    return test ? filter$2(test, nodes, recurse, limit) : [];
  }
  function getElementById(id, nodes, recurse = true) {
    if (!Array.isArray(nodes))
      nodes = [nodes];
    return findOne(getAttribCheck("id", id), nodes, recurse);
  }
  function getElementsByTagName(tagName, nodes, recurse = true, limit = Infinity) {
    return filter$2(Checks["tag_name"](tagName), nodes, recurse, limit);
  }
  function getElementsByTagType(type2, nodes, recurse = true, limit = Infinity) {
    return filter$2(Checks["tag_type"](type2), nodes, recurse, limit);
  }
  function removeSubsets(nodes) {
    let idx = nodes.length;
    while (--idx >= 0) {
      const node = nodes[idx];
      if (idx > 0 && nodes.lastIndexOf(node, idx - 1) >= 0) {
        nodes.splice(idx, 1);
        continue;
      }
      for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        if (nodes.includes(ancestor)) {
          nodes.splice(idx, 1);
          break;
        }
      }
    }
    return nodes;
  }
  var DocumentPosition;
  (function(DocumentPosition2) {
    DocumentPosition2[DocumentPosition2["DISCONNECTED"] = 1] = "DISCONNECTED";
    DocumentPosition2[DocumentPosition2["PRECEDING"] = 2] = "PRECEDING";
    DocumentPosition2[DocumentPosition2["FOLLOWING"] = 4] = "FOLLOWING";
    DocumentPosition2[DocumentPosition2["CONTAINS"] = 8] = "CONTAINS";
    DocumentPosition2[DocumentPosition2["CONTAINED_BY"] = 16] = "CONTAINED_BY";
  })(DocumentPosition || (DocumentPosition = {}));
  function compareDocumentPosition(nodeA, nodeB) {
    const aParents = [];
    const bParents = [];
    if (nodeA === nodeB) {
      return 0;
    }
    let current = hasChildren(nodeA) ? nodeA : nodeA.parent;
    while (current) {
      aParents.unshift(current);
      current = current.parent;
    }
    current = hasChildren(nodeB) ? nodeB : nodeB.parent;
    while (current) {
      bParents.unshift(current);
      current = current.parent;
    }
    const maxIdx = Math.min(aParents.length, bParents.length);
    let idx = 0;
    while (idx < maxIdx && aParents[idx] === bParents[idx]) {
      idx++;
    }
    if (idx === 0) {
      return DocumentPosition.DISCONNECTED;
    }
    const sharedParent = aParents[idx - 1];
    const siblings2 = sharedParent.children;
    const aSibling = aParents[idx];
    const bSibling = bParents[idx];
    if (siblings2.indexOf(aSibling) > siblings2.indexOf(bSibling)) {
      if (sharedParent === nodeB) {
        return DocumentPosition.FOLLOWING | DocumentPosition.CONTAINED_BY;
      }
      return DocumentPosition.FOLLOWING;
    }
    if (sharedParent === nodeA) {
      return DocumentPosition.PRECEDING | DocumentPosition.CONTAINS;
    }
    return DocumentPosition.PRECEDING;
  }
  function uniqueSort(nodes) {
    nodes = nodes.filter((node, i2, arr) => !arr.includes(node, i2 + 1));
    nodes.sort((a, b) => {
      const relative = compareDocumentPosition(a, b);
      if (relative & DocumentPosition.PRECEDING) {
        return -1;
      } else if (relative & DocumentPosition.FOLLOWING) {
        return 1;
      }
      return 0;
    });
    return nodes;
  }
  function getFeed(doc) {
    const feedRoot = getOneElement(isValidFeed, doc);
    return !feedRoot ? null : feedRoot.name === "feed" ? getAtomFeed(feedRoot) : getRssFeed(feedRoot);
  }
  function getAtomFeed(feedRoot) {
    var _a2;
    const childs = feedRoot.children;
    const feed = {
      type: "atom",
      items: getElementsByTagName("entry", childs).map((item) => {
        var _a3;
        const { children: children2 } = item;
        const entry = { media: getMediaElements(children2) };
        addConditionally(entry, "id", "id", children2);
        addConditionally(entry, "title", "title", children2);
        const href2 = (_a3 = getOneElement("link", children2)) === null || _a3 === void 0 ? void 0 : _a3.attribs["href"];
        if (href2) {
          entry.link = href2;
        }
        const description = fetch$1("summary", children2) || fetch$1("content", children2);
        if (description) {
          entry.description = description;
        }
        const pubDate = fetch$1("updated", children2);
        if (pubDate) {
          entry.pubDate = new Date(pubDate);
        }
        return entry;
      })
    };
    addConditionally(feed, "id", "id", childs);
    addConditionally(feed, "title", "title", childs);
    const href = (_a2 = getOneElement("link", childs)) === null || _a2 === void 0 ? void 0 : _a2.attribs["href"];
    if (href) {
      feed.link = href;
    }
    addConditionally(feed, "description", "subtitle", childs);
    const updated = fetch$1("updated", childs);
    if (updated) {
      feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "email", childs, true);
    return feed;
  }
  function getRssFeed(feedRoot) {
    var _a2, _b;
    const childs = (_b = (_a2 = getOneElement("channel", feedRoot.children)) === null || _a2 === void 0 ? void 0 : _a2.children) !== null && _b !== void 0 ? _b : [];
    const feed = {
      type: feedRoot.name.substr(0, 3),
      id: "",
      items: getElementsByTagName("item", feedRoot.children).map((item) => {
        const { children: children2 } = item;
        const entry = { media: getMediaElements(children2) };
        addConditionally(entry, "id", "guid", children2);
        addConditionally(entry, "title", "title", children2);
        addConditionally(entry, "link", "link", children2);
        addConditionally(entry, "description", "description", children2);
        const pubDate = fetch$1("pubDate", children2) || fetch$1("dc:date", children2);
        if (pubDate)
          entry.pubDate = new Date(pubDate);
        return entry;
      })
    };
    addConditionally(feed, "title", "title", childs);
    addConditionally(feed, "link", "link", childs);
    addConditionally(feed, "description", "description", childs);
    const updated = fetch$1("lastBuildDate", childs);
    if (updated) {
      feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "managingEditor", childs, true);
    return feed;
  }
  const MEDIA_KEYS_STRING = ["url", "type", "lang"];
  const MEDIA_KEYS_INT = [
    "fileSize",
    "bitrate",
    "framerate",
    "samplingrate",
    "channels",
    "duration",
    "height",
    "width"
  ];
  function getMediaElements(where) {
    return getElementsByTagName("media:content", where).map((elem) => {
      const { attribs } = elem;
      const media = {
        medium: attribs["medium"],
        isDefault: !!attribs["isDefault"]
      };
      for (const attrib of MEDIA_KEYS_STRING) {
        if (attribs[attrib]) {
          media[attrib] = attribs[attrib];
        }
      }
      for (const attrib of MEDIA_KEYS_INT) {
        if (attribs[attrib]) {
          media[attrib] = parseInt(attribs[attrib], 10);
        }
      }
      if (attribs["expression"]) {
        media.expression = attribs["expression"];
      }
      return media;
    });
  }
  function getOneElement(tagName, node) {
    return getElementsByTagName(tagName, node, true, 1)[0];
  }
  function fetch$1(tagName, where, recurse = false) {
    return textContent(getElementsByTagName(tagName, where, recurse, 1)).trim();
  }
  function addConditionally(obj, prop2, tagName, where, recurse = false) {
    const val2 = fetch$1(tagName, where, recurse);
    if (val2)
      obj[prop2] = val2;
  }
  function isValidFeed(value) {
    return value === "rss" || value === "feed" || value === "rdf:RDF";
  }
  const DomUtils = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    get DocumentPosition() {
      return DocumentPosition;
    },
    append: append$1,
    appendChild,
    compareDocumentPosition,
    existsOne,
    filter: filter$2,
    find: find$2,
    findAll,
    findOne,
    findOneChild,
    getAttributeValue,
    getChildren,
    getElementById,
    getElements,
    getElementsByTagName,
    getElementsByTagType,
    getFeed,
    getInnerHTML,
    getName,
    getOuterHTML,
    getParent,
    getSiblings,
    getText,
    hasAttrib,
    hasChildren,
    innerText,
    isCDATA,
    isComment,
    isDocument,
    isTag,
    isText,
    nextElementSibling,
    prepend: prepend$1,
    prependChild,
    prevElementSibling,
    removeElement,
    removeSubsets,
    replaceElement,
    testElement,
    textContent,
    uniqueSort
  }, Symbol.toStringTag, { value: "Module" }));
  function render(that, dom, options) {
    if (!that)
      return "";
    return that(dom !== null && dom !== void 0 ? dom : that._root.children, null, void 0, options).toString();
  }
  function isOptions(dom, options) {
    return !options && typeof dom === "object" && dom != null && !("length" in dom) && !("type" in dom);
  }
  function html$1(dom, options) {
    const toRender = isOptions(dom) ? (options = dom, void 0) : dom;
    const opts = {
      ...defaultOpts$2,
      ...this === null || this === void 0 ? void 0 : this._options,
      ...flatten(options !== null && options !== void 0 ? options : {})
    };
    return render(this, toRender, opts);
  }
  function xml(dom) {
    const options = { ...this._options, xmlMode: true };
    return render(this, dom, options);
  }
  function text$2(elements) {
    const elems = elements ? elements : this ? this.root() : [];
    let ret = "";
    for (let i2 = 0; i2 < elems.length; i2++) {
      ret += textContent(elems[i2]);
    }
    return ret;
  }
  function parseHTML(data2, context, keepScripts = typeof context === "boolean" ? context : false) {
    if (!data2 || typeof data2 !== "string") {
      return null;
    }
    if (typeof context === "boolean") {
      keepScripts = context;
    }
    const parsed = this.load(data2, defaultOpts$2, false);
    if (!keepScripts) {
      parsed("script").remove();
    }
    return parsed.root()[0].children.slice();
  }
  function root() {
    return this(this._root);
  }
  function contains(container, contained) {
    if (contained === container) {
      return false;
    }
    let next2 = contained;
    while (next2 && next2 !== next2.parent) {
      next2 = next2.parent;
      if (next2 === container) {
        return true;
      }
    }
    return false;
  }
  function merge$1(arr1, arr2) {
    if (!isArrayLike(arr1) || !isArrayLike(arr2)) {
      return;
    }
    let newLength = arr1.length;
    const len = +arr2.length;
    for (let i2 = 0; i2 < len; i2++) {
      arr1[newLength++] = arr2[i2];
    }
    arr1.length = newLength;
    return arr1;
  }
  function isArrayLike(item) {
    if (Array.isArray(item)) {
      return true;
    }
    if (typeof item !== "object" || !Object.prototype.hasOwnProperty.call(item, "length") || typeof item.length !== "number" || item.length < 0) {
      return false;
    }
    for (let i2 = 0; i2 < item.length; i2++) {
      if (!(i2 in item)) {
        return false;
      }
    }
    return true;
  }
  const staticMethods = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    contains,
    html: html$1,
    merge: merge$1,
    parseHTML,
    root,
    text: text$2,
    xml
  }, Symbol.toStringTag, { value: "Module" }));
  function isCheerio(maybeCheerio) {
    return maybeCheerio.cheerio != null;
  }
  function camelCase(str2) {
    return str2.replace(/[_.-](\w|$)/g, (_, x) => x.toUpperCase());
  }
  function cssCase(str2) {
    return str2.replace(/[A-Z]/g, "-$&").toLowerCase();
  }
  function domEach(array, fn) {
    const len = array.length;
    for (let i2 = 0; i2 < len; i2++)
      fn(array[i2], i2);
    return array;
  }
  function cloneDom(dom) {
    const clone2 = "length" in dom ? Array.prototype.map.call(dom, (el) => cloneNode(el, true)) : [cloneNode(dom, true)];
    const root2 = new Document(clone2);
    clone2.forEach((node) => {
      node.parent = root2;
    });
    return clone2;
  }
  var CharacterCodes;
  (function(CharacterCodes2) {
    CharacterCodes2[CharacterCodes2["LowerA"] = 97] = "LowerA";
    CharacterCodes2[CharacterCodes2["LowerZ"] = 122] = "LowerZ";
    CharacterCodes2[CharacterCodes2["UpperA"] = 65] = "UpperA";
    CharacterCodes2[CharacterCodes2["UpperZ"] = 90] = "UpperZ";
    CharacterCodes2[CharacterCodes2["Exclamation"] = 33] = "Exclamation";
  })(CharacterCodes || (CharacterCodes = {}));
  function isHtml(str2) {
    const tagStart = str2.indexOf("<");
    if (tagStart < 0 || tagStart > str2.length - 3)
      return false;
    const tagChar = str2.charCodeAt(tagStart + 1);
    return (tagChar >= CharacterCodes.LowerA && tagChar <= CharacterCodes.LowerZ || tagChar >= CharacterCodes.UpperA && tagChar <= CharacterCodes.UpperZ || tagChar === CharacterCodes.Exclamation) && str2.includes(">", tagStart + 2);
  }
  const hasOwn$1 = Object.prototype.hasOwnProperty;
  const rspace = /\s+/;
  const dataAttrPrefix = "data-";
  const primitives = {
    null: null,
    true: true,
    false: false
  };
  const rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i;
  const rbrace = /^{[^]*}$|^\[[^]*]$/;
  function getAttr(elem, name2, xmlMode) {
    var _a2;
    if (!elem || !isTag(elem))
      return void 0;
    (_a2 = elem.attribs) !== null && _a2 !== void 0 ? _a2 : elem.attribs = {};
    if (!name2) {
      return elem.attribs;
    }
    if (hasOwn$1.call(elem.attribs, name2)) {
      return !xmlMode && rboolean.test(name2) ? name2 : elem.attribs[name2];
    }
    if (elem.name === "option" && name2 === "value") {
      return text$2(elem.children);
    }
    if (elem.name === "input" && (elem.attribs["type"] === "radio" || elem.attribs["type"] === "checkbox") && name2 === "value") {
      return "on";
    }
    return void 0;
  }
  function setAttr(el, name2, value) {
    if (value === null) {
      removeAttribute(el, name2);
    } else {
      el.attribs[name2] = `${value}`;
    }
  }
  function attr(name2, value) {
    if (typeof name2 === "object" || value !== void 0) {
      if (typeof value === "function") {
        if (typeof name2 !== "string") {
          {
            throw new Error("Bad combination of arguments.");
          }
        }
        return domEach(this, (el, i2) => {
          if (isTag(el))
            setAttr(el, name2, value.call(el, i2, el.attribs[name2]));
        });
      }
      return domEach(this, (el) => {
        if (!isTag(el))
          return;
        if (typeof name2 === "object") {
          Object.keys(name2).forEach((objName) => {
            const objValue = name2[objName];
            setAttr(el, objName, objValue);
          });
        } else {
          setAttr(el, name2, value);
        }
      });
    }
    return arguments.length > 1 ? this : getAttr(this[0], name2, this.options.xmlMode);
  }
  function getProp(el, name2, xmlMode) {
    return name2 in el ? (
      // @ts-expect-error TS doesn't like us accessing the value directly here.
      el[name2]
    ) : !xmlMode && rboolean.test(name2) ? getAttr(el, name2, false) !== void 0 : getAttr(el, name2, xmlMode);
  }
  function setProp(el, name2, value, xmlMode) {
    if (name2 in el) {
      el[name2] = value;
    } else {
      setAttr(el, name2, !xmlMode && rboolean.test(name2) ? value ? "" : null : `${value}`);
    }
  }
  function prop(name2, value) {
    var _a2;
    if (typeof name2 === "string" && value === void 0) {
      const el = this[0];
      if (!el || !isTag(el))
        return void 0;
      switch (name2) {
        case "style": {
          const property = this.css();
          const keys = Object.keys(property);
          keys.forEach((p, i2) => {
            property[i2] = p;
          });
          property.length = keys.length;
          return property;
        }
        case "tagName":
        case "nodeName": {
          return el.name.toUpperCase();
        }
        case "href":
        case "src": {
          const prop2 = (_a2 = el.attribs) === null || _a2 === void 0 ? void 0 : _a2[name2];
          if (typeof URL !== "undefined" && (name2 === "href" && (el.tagName === "a" || el.name === "link") || name2 === "src" && (el.tagName === "img" || el.tagName === "iframe" || el.tagName === "audio" || el.tagName === "video" || el.tagName === "source")) && prop2 !== void 0 && this.options.baseURI) {
            return new URL(prop2, this.options.baseURI).href;
          }
          return prop2;
        }
        case "innerText": {
          return innerText(el);
        }
        case "textContent": {
          return textContent(el);
        }
        case "outerHTML":
          return this.clone().wrap("<container />").parent().html();
        case "innerHTML":
          return this.html();
        default:
          return getProp(el, name2, this.options.xmlMode);
      }
    }
    if (typeof name2 === "object" || value !== void 0) {
      if (typeof value === "function") {
        if (typeof name2 === "object") {
          throw new Error("Bad combination of arguments.");
        }
        return domEach(this, (el, i2) => {
          if (isTag(el)) {
            setProp(el, name2, value.call(el, i2, getProp(el, name2, this.options.xmlMode)), this.options.xmlMode);
          }
        });
      }
      return domEach(this, (el) => {
        if (!isTag(el))
          return;
        if (typeof name2 === "object") {
          Object.keys(name2).forEach((key) => {
            const val2 = name2[key];
            setProp(el, key, val2, this.options.xmlMode);
          });
        } else {
          setProp(el, name2, value, this.options.xmlMode);
        }
      });
    }
    return void 0;
  }
  function setData(el, name2, value) {
    var _a2;
    const elem = el;
    (_a2 = elem.data) !== null && _a2 !== void 0 ? _a2 : elem.data = {};
    if (typeof name2 === "object")
      Object.assign(elem.data, name2);
    else if (typeof name2 === "string" && value !== void 0) {
      elem.data[name2] = value;
    }
  }
  function readData(el, name2) {
    let domNames;
    let jsNames;
    let value;
    if (name2 == null) {
      domNames = Object.keys(el.attribs).filter((attrName) => attrName.startsWith(dataAttrPrefix));
      jsNames = domNames.map((domName) => camelCase(domName.slice(dataAttrPrefix.length)));
    } else {
      domNames = [dataAttrPrefix + cssCase(name2)];
      jsNames = [name2];
    }
    for (let idx = 0; idx < domNames.length; ++idx) {
      const domName = domNames[idx];
      const jsName = jsNames[idx];
      if (hasOwn$1.call(el.attribs, domName) && !hasOwn$1.call(el.data, jsName)) {
        value = el.attribs[domName];
        if (hasOwn$1.call(primitives, value)) {
          value = primitives[value];
        } else if (value === String(Number(value))) {
          value = Number(value);
        } else if (rbrace.test(value)) {
          try {
            value = JSON.parse(value);
          } catch (e) {
          }
        }
        el.data[jsName] = value;
      }
    }
    return name2 == null ? el.data : value;
  }
  function data(name2, value) {
    var _a2;
    const elem = this[0];
    if (!elem || !isTag(elem))
      return;
    const dataEl = elem;
    (_a2 = dataEl.data) !== null && _a2 !== void 0 ? _a2 : dataEl.data = {};
    if (!name2) {
      return readData(dataEl);
    }
    if (typeof name2 === "object" || value !== void 0) {
      domEach(this, (el) => {
        if (isTag(el)) {
          if (typeof name2 === "object")
            setData(el, name2);
          else
            setData(el, name2, value);
        }
      });
      return this;
    }
    if (hasOwn$1.call(dataEl.data, name2)) {
      return dataEl.data[name2];
    }
    return readData(dataEl, name2);
  }
  function val(value) {
    const querying = arguments.length === 0;
    const element = this[0];
    if (!element || !isTag(element))
      return querying ? void 0 : this;
    switch (element.name) {
      case "textarea":
        return this.text(value);
      case "select": {
        const option = this.find("option:selected");
        if (!querying) {
          if (this.attr("multiple") == null && typeof value === "object") {
            return this;
          }
          this.find("option").removeAttr("selected");
          const values = typeof value !== "object" ? [value] : value;
          for (let i2 = 0; i2 < values.length; i2++) {
            this.find(`option[value="${values[i2]}"]`).attr("selected", "");
          }
          return this;
        }
        return this.attr("multiple") ? option.toArray().map((el) => text$2(el.children)) : option.attr("value");
      }
      case "input":
      case "option":
        return querying ? this.attr("value") : this.attr("value", value);
    }
    return void 0;
  }
  function removeAttribute(elem, name2) {
    if (!elem.attribs || !hasOwn$1.call(elem.attribs, name2))
      return;
    delete elem.attribs[name2];
  }
  function splitNames(names) {
    return names ? names.trim().split(rspace) : [];
  }
  function removeAttr(name2) {
    const attrNames = splitNames(name2);
    for (let i2 = 0; i2 < attrNames.length; i2++) {
      domEach(this, (elem) => {
        if (isTag(elem))
          removeAttribute(elem, attrNames[i2]);
      });
    }
    return this;
  }
  function hasClass(className) {
    return this.toArray().some((elem) => {
      const clazz = isTag(elem) && elem.attribs["class"];
      let idx = -1;
      if (clazz && className.length) {
        while ((idx = clazz.indexOf(className, idx + 1)) > -1) {
          const end2 = idx + className.length;
          if ((idx === 0 || rspace.test(clazz[idx - 1])) && (end2 === clazz.length || rspace.test(clazz[end2]))) {
            return true;
          }
        }
      }
      return false;
    });
  }
  function addClass(value) {
    if (typeof value === "function") {
      return domEach(this, (el, i2) => {
        if (isTag(el)) {
          const className = el.attribs["class"] || "";
          addClass.call([el], value.call(el, i2, className));
        }
      });
    }
    if (!value || typeof value !== "string")
      return this;
    const classNames = value.split(rspace);
    const numElements = this.length;
    for (let i2 = 0; i2 < numElements; i2++) {
      const el = this[i2];
      if (!isTag(el))
        continue;
      const className = getAttr(el, "class", false);
      if (!className) {
        setAttr(el, "class", classNames.join(" ").trim());
      } else {
        let setClass = ` ${className} `;
        for (let j = 0; j < classNames.length; j++) {
          const appendClass = `${classNames[j]} `;
          if (!setClass.includes(` ${appendClass}`))
            setClass += appendClass;
        }
        setAttr(el, "class", setClass.trim());
      }
    }
    return this;
  }
  function removeClass(name2) {
    if (typeof name2 === "function") {
      return domEach(this, (el, i2) => {
        if (isTag(el)) {
          removeClass.call([el], name2.call(el, i2, el.attribs["class"] || ""));
        }
      });
    }
    const classes = splitNames(name2);
    const numClasses = classes.length;
    const removeAll = arguments.length === 0;
    return domEach(this, (el) => {
      if (!isTag(el))
        return;
      if (removeAll) {
        el.attribs["class"] = "";
      } else {
        const elClasses = splitNames(el.attribs["class"]);
        let changed = false;
        for (let j = 0; j < numClasses; j++) {
          const index2 = elClasses.indexOf(classes[j]);
          if (index2 >= 0) {
            elClasses.splice(index2, 1);
            changed = true;
            j--;
          }
        }
        if (changed) {
          el.attribs["class"] = elClasses.join(" ");
        }
      }
    });
  }
  function toggleClass(value, stateVal) {
    if (typeof value === "function") {
      return domEach(this, (el, i2) => {
        if (isTag(el)) {
          toggleClass.call([el], value.call(el, i2, el.attribs["class"] || "", stateVal), stateVal);
        }
      });
    }
    if (!value || typeof value !== "string")
      return this;
    const classNames = value.split(rspace);
    const numClasses = classNames.length;
    const state = typeof stateVal === "boolean" ? stateVal ? 1 : -1 : 0;
    const numElements = this.length;
    for (let i2 = 0; i2 < numElements; i2++) {
      const el = this[i2];
      if (!isTag(el))
        continue;
      const elementClasses = splitNames(el.attribs["class"]);
      for (let j = 0; j < numClasses; j++) {
        const index2 = elementClasses.indexOf(classNames[j]);
        if (state >= 0 && index2 < 0) {
          elementClasses.push(classNames[j]);
        } else if (state <= 0 && index2 >= 0) {
          elementClasses.splice(index2, 1);
        }
      }
      el.attribs["class"] = elementClasses.join(" ");
    }
    return this;
  }
  const Attributes = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    addClass,
    attr,
    data,
    hasClass,
    prop,
    removeAttr,
    removeClass,
    toggleClass,
    val
  }, Symbol.toStringTag, { value: "Module" }));
  var SelectorType;
  (function(SelectorType2) {
    SelectorType2["Attribute"] = "attribute";
    SelectorType2["Pseudo"] = "pseudo";
    SelectorType2["PseudoElement"] = "pseudo-element";
    SelectorType2["Tag"] = "tag";
    SelectorType2["Universal"] = "universal";
    SelectorType2["Adjacent"] = "adjacent";
    SelectorType2["Child"] = "child";
    SelectorType2["Descendant"] = "descendant";
    SelectorType2["Parent"] = "parent";
    SelectorType2["Sibling"] = "sibling";
    SelectorType2["ColumnCombinator"] = "column-combinator";
  })(SelectorType || (SelectorType = {}));
  var AttributeAction;
  (function(AttributeAction2) {
    AttributeAction2["Any"] = "any";
    AttributeAction2["Element"] = "element";
    AttributeAction2["End"] = "end";
    AttributeAction2["Equals"] = "equals";
    AttributeAction2["Exists"] = "exists";
    AttributeAction2["Hyphen"] = "hyphen";
    AttributeAction2["Not"] = "not";
    AttributeAction2["Start"] = "start";
  })(AttributeAction || (AttributeAction = {}));
  const reName = /^[^\\#]?(?:\\(?:[\da-f]{1,6}\s?|.)|[\w\-\u00b0-\uFFFF])+/;
  const reEscape = /\\([\da-f]{1,6}\s?|(\s)|.)/gi;
  const actionTypes = /* @__PURE__ */ new Map([
    [126, AttributeAction.Element],
    [94, AttributeAction.Start],
    [36, AttributeAction.End],
    [42, AttributeAction.Any],
    [33, AttributeAction.Not],
    [124, AttributeAction.Hyphen]
  ]);
  const unpackPseudos = /* @__PURE__ */ new Set([
    "has",
    "not",
    "matches",
    "is",
    "where",
    "host",
    "host-context"
  ]);
  function isTraversal$1(selector) {
    switch (selector.type) {
      case SelectorType.Adjacent:
      case SelectorType.Child:
      case SelectorType.Descendant:
      case SelectorType.Parent:
      case SelectorType.Sibling:
      case SelectorType.ColumnCombinator:
        return true;
      default:
        return false;
    }
  }
  const stripQuotesFromPseudos = /* @__PURE__ */ new Set(["contains", "icontains"]);
  function funescape(_, escaped, escapedWhitespace) {
    const high = parseInt(escaped, 16) - 65536;
    return high !== high || escapedWhitespace ? escaped : high < 0 ? (
      // BMP codepoint
      String.fromCharCode(high + 65536)
    ) : (
      // Supplemental Plane codepoint (surrogate pair)
      String.fromCharCode(high >> 10 | 55296, high & 1023 | 56320)
    );
  }
  function unescapeCSS(str2) {
    return str2.replace(reEscape, funescape);
  }
  function isQuote(c) {
    return c === 39 || c === 34;
  }
  function isWhitespace$3(c) {
    return c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
  }
  function parse$4(selector) {
    const subselects2 = [];
    const endIndex = parseSelector(subselects2, `${selector}`, 0);
    if (endIndex < selector.length) {
      throw new Error(`Unmatched selector: ${selector.slice(endIndex)}`);
    }
    return subselects2;
  }
  function parseSelector(subselects2, selector, selectorIndex) {
    let tokens = [];
    function getName2(offset) {
      const match = selector.slice(selectorIndex + offset).match(reName);
      if (!match) {
        throw new Error(`Expected name, found ${selector.slice(selectorIndex)}`);
      }
      const [name2] = match;
      selectorIndex += offset + name2.length;
      return unescapeCSS(name2);
    }
    function stripWhitespace(offset) {
      selectorIndex += offset;
      while (selectorIndex < selector.length && isWhitespace$3(selector.charCodeAt(selectorIndex))) {
        selectorIndex++;
      }
    }
    function readValueWithParenthesis() {
      selectorIndex += 1;
      const start = selectorIndex;
      let counter = 1;
      for (; counter > 0 && selectorIndex < selector.length; selectorIndex++) {
        if (selector.charCodeAt(selectorIndex) === 40 && !isEscaped(selectorIndex)) {
          counter++;
        } else if (selector.charCodeAt(selectorIndex) === 41 && !isEscaped(selectorIndex)) {
          counter--;
        }
      }
      if (counter) {
        throw new Error("Parenthesis not matched");
      }
      return unescapeCSS(selector.slice(start, selectorIndex - 1));
    }
    function isEscaped(pos) {
      let slashCount = 0;
      while (selector.charCodeAt(--pos) === 92)
        slashCount++;
      return (slashCount & 1) === 1;
    }
    function ensureNotTraversal() {
      if (tokens.length > 0 && isTraversal$1(tokens[tokens.length - 1])) {
        throw new Error("Did not expect successive traversals.");
      }
    }
    function addTraversal(type2) {
      if (tokens.length > 0 && tokens[tokens.length - 1].type === SelectorType.Descendant) {
        tokens[tokens.length - 1].type = type2;
        return;
      }
      ensureNotTraversal();
      tokens.push({ type: type2 });
    }
    function addSpecialAttribute(name2, action) {
      tokens.push({
        type: SelectorType.Attribute,
        name: name2,
        action,
        value: getName2(1),
        namespace: null,
        ignoreCase: "quirks"
      });
    }
    function finalizeSubselector() {
      if (tokens.length && tokens[tokens.length - 1].type === SelectorType.Descendant) {
        tokens.pop();
      }
      if (tokens.length === 0) {
        throw new Error("Empty sub-selector");
      }
      subselects2.push(tokens);
    }
    stripWhitespace(0);
    if (selector.length === selectorIndex) {
      return selectorIndex;
    }
    loop:
      while (selectorIndex < selector.length) {
        const firstChar = selector.charCodeAt(selectorIndex);
        switch (firstChar) {
          case 32:
          case 9:
          case 10:
          case 12:
          case 13: {
            if (tokens.length === 0 || tokens[0].type !== SelectorType.Descendant) {
              ensureNotTraversal();
              tokens.push({ type: SelectorType.Descendant });
            }
            stripWhitespace(1);
            break;
          }
          case 62: {
            addTraversal(SelectorType.Child);
            stripWhitespace(1);
            break;
          }
          case 60: {
            addTraversal(SelectorType.Parent);
            stripWhitespace(1);
            break;
          }
          case 126: {
            addTraversal(SelectorType.Sibling);
            stripWhitespace(1);
            break;
          }
          case 43: {
            addTraversal(SelectorType.Adjacent);
            stripWhitespace(1);
            break;
          }
          case 46: {
            addSpecialAttribute("class", AttributeAction.Element);
            break;
          }
          case 35: {
            addSpecialAttribute("id", AttributeAction.Equals);
            break;
          }
          case 91: {
            stripWhitespace(1);
            let name2;
            let namespace = null;
            if (selector.charCodeAt(selectorIndex) === 124) {
              name2 = getName2(1);
            } else if (selector.startsWith("*|", selectorIndex)) {
              namespace = "*";
              name2 = getName2(2);
            } else {
              name2 = getName2(0);
              if (selector.charCodeAt(selectorIndex) === 124 && selector.charCodeAt(selectorIndex + 1) !== 61) {
                namespace = name2;
                name2 = getName2(1);
              }
            }
            stripWhitespace(0);
            let action = AttributeAction.Exists;
            const possibleAction = actionTypes.get(selector.charCodeAt(selectorIndex));
            if (possibleAction) {
              action = possibleAction;
              if (selector.charCodeAt(selectorIndex + 1) !== 61) {
                throw new Error("Expected `=`");
              }
              stripWhitespace(2);
            } else if (selector.charCodeAt(selectorIndex) === 61) {
              action = AttributeAction.Equals;
              stripWhitespace(1);
            }
            let value = "";
            let ignoreCase = null;
            if (action !== "exists") {
              if (isQuote(selector.charCodeAt(selectorIndex))) {
                const quote = selector.charCodeAt(selectorIndex);
                let sectionEnd = selectorIndex + 1;
                while (sectionEnd < selector.length && (selector.charCodeAt(sectionEnd) !== quote || isEscaped(sectionEnd))) {
                  sectionEnd += 1;
                }
                if (selector.charCodeAt(sectionEnd) !== quote) {
                  throw new Error("Attribute value didn't end");
                }
                value = unescapeCSS(selector.slice(selectorIndex + 1, sectionEnd));
                selectorIndex = sectionEnd + 1;
              } else {
                const valueStart = selectorIndex;
                while (selectorIndex < selector.length && (!isWhitespace$3(selector.charCodeAt(selectorIndex)) && selector.charCodeAt(selectorIndex) !== 93 || isEscaped(selectorIndex))) {
                  selectorIndex += 1;
                }
                value = unescapeCSS(selector.slice(valueStart, selectorIndex));
              }
              stripWhitespace(0);
              const forceIgnore = selector.charCodeAt(selectorIndex) | 32;
              if (forceIgnore === 115) {
                ignoreCase = false;
                stripWhitespace(1);
              } else if (forceIgnore === 105) {
                ignoreCase = true;
                stripWhitespace(1);
              }
            }
            if (selector.charCodeAt(selectorIndex) !== 93) {
              throw new Error("Attribute selector didn't terminate");
            }
            selectorIndex += 1;
            const attributeSelector = {
              type: SelectorType.Attribute,
              name: name2,
              action,
              value,
              namespace,
              ignoreCase
            };
            tokens.push(attributeSelector);
            break;
          }
          case 58: {
            if (selector.charCodeAt(selectorIndex + 1) === 58) {
              tokens.push({
                type: SelectorType.PseudoElement,
                name: getName2(2).toLowerCase(),
                data: selector.charCodeAt(selectorIndex) === 40 ? readValueWithParenthesis() : null
              });
              continue;
            }
            const name2 = getName2(1).toLowerCase();
            let data2 = null;
            if (selector.charCodeAt(selectorIndex) === 40) {
              if (unpackPseudos.has(name2)) {
                if (isQuote(selector.charCodeAt(selectorIndex + 1))) {
                  throw new Error(`Pseudo-selector ${name2} cannot be quoted`);
                }
                data2 = [];
                selectorIndex = parseSelector(data2, selector, selectorIndex + 1);
                if (selector.charCodeAt(selectorIndex) !== 41) {
                  throw new Error(`Missing closing parenthesis in :${name2} (${selector})`);
                }
                selectorIndex += 1;
              } else {
                data2 = readValueWithParenthesis();
                if (stripQuotesFromPseudos.has(name2)) {
                  const quot = data2.charCodeAt(0);
                  if (quot === data2.charCodeAt(data2.length - 1) && isQuote(quot)) {
                    data2 = data2.slice(1, -1);
                  }
                }
                data2 = unescapeCSS(data2);
              }
            }
            tokens.push({ type: SelectorType.Pseudo, name: name2, data: data2 });
            break;
          }
          case 44: {
            finalizeSubselector();
            tokens = [];
            stripWhitespace(1);
            break;
          }
          default: {
            if (selector.startsWith("/*", selectorIndex)) {
              const endIndex = selector.indexOf("*/", selectorIndex + 2);
              if (endIndex < 0) {
                throw new Error("Comment was not terminated");
              }
              selectorIndex = endIndex + 2;
              if (tokens.length === 0) {
                stripWhitespace(0);
              }
              break;
            }
            let namespace = null;
            let name2;
            if (firstChar === 42) {
              selectorIndex += 1;
              name2 = "*";
            } else if (firstChar === 124) {
              name2 = "";
              if (selector.charCodeAt(selectorIndex + 1) === 124) {
                addTraversal(SelectorType.ColumnCombinator);
                stripWhitespace(2);
                break;
              }
            } else if (reName.test(selector.slice(selectorIndex))) {
              name2 = getName2(0);
            } else {
              break loop;
            }
            if (selector.charCodeAt(selectorIndex) === 124 && selector.charCodeAt(selectorIndex + 1) !== 124) {
              namespace = name2;
              if (selector.charCodeAt(selectorIndex + 1) === 42) {
                name2 = "*";
                selectorIndex += 2;
              } else {
                name2 = getName2(1);
              }
            }
            tokens.push(name2 === "*" ? { type: SelectorType.Universal, namespace } : { type: SelectorType.Tag, name: name2, namespace });
          }
        }
      }
    finalizeSubselector();
    return selectorIndex;
  }
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var boolbase = {
    trueFunc: function trueFunc() {
      return true;
    },
    falseFunc: function falseFunc() {
      return false;
    }
  };
  const boolbase$1 = /* @__PURE__ */ getDefaultExportFromCjs(boolbase);
  const procedure = /* @__PURE__ */ new Map([
    [SelectorType.Universal, 50],
    [SelectorType.Tag, 30],
    [SelectorType.Attribute, 1],
    [SelectorType.Pseudo, 0]
  ]);
  function isTraversal(token) {
    return !procedure.has(token.type);
  }
  const attributes = /* @__PURE__ */ new Map([
    [AttributeAction.Exists, 10],
    [AttributeAction.Equals, 8],
    [AttributeAction.Not, 7],
    [AttributeAction.Start, 6],
    [AttributeAction.End, 6],
    [AttributeAction.Any, 5]
  ]);
  function sortByProcedure(arr) {
    const procs = arr.map(getProcedure);
    for (let i2 = 1; i2 < arr.length; i2++) {
      const procNew = procs[i2];
      if (procNew < 0)
        continue;
      for (let j = i2 - 1; j >= 0 && procNew < procs[j]; j--) {
        const token = arr[j + 1];
        arr[j + 1] = arr[j];
        arr[j] = token;
        procs[j + 1] = procs[j];
        procs[j] = procNew;
      }
    }
  }
  function getProcedure(token) {
    var _a2, _b;
    let proc = (_a2 = procedure.get(token.type)) !== null && _a2 !== void 0 ? _a2 : -1;
    if (token.type === SelectorType.Attribute) {
      proc = (_b = attributes.get(token.action)) !== null && _b !== void 0 ? _b : 4;
      if (token.action === AttributeAction.Equals && token.name === "id") {
        proc = 9;
      }
      if (token.ignoreCase) {
        proc >>= 1;
      }
    } else if (token.type === SelectorType.Pseudo) {
      if (!token.data) {
        proc = 3;
      } else if (token.name === "has" || token.name === "contains") {
        proc = 0;
      } else if (Array.isArray(token.data)) {
        proc = Math.min(...token.data.map((d) => Math.min(...d.map(getProcedure))));
        if (proc < 0) {
          proc = 0;
        }
      } else {
        proc = 2;
      }
    }
    return proc;
  }
  const reChars = /[-[\]{}()*+?.,\\^$|#\s]/g;
  function escapeRegex(value) {
    return value.replace(reChars, "\\$&");
  }
  const caseInsensitiveAttributes = /* @__PURE__ */ new Set([
    "accept",
    "accept-charset",
    "align",
    "alink",
    "axis",
    "bgcolor",
    "charset",
    "checked",
    "clear",
    "codetype",
    "color",
    "compact",
    "declare",
    "defer",
    "dir",
    "direction",
    "disabled",
    "enctype",
    "face",
    "frame",
    "hreflang",
    "http-equiv",
    "lang",
    "language",
    "link",
    "media",
    "method",
    "multiple",
    "nohref",
    "noresize",
    "noshade",
    "nowrap",
    "readonly",
    "rel",
    "rev",
    "rules",
    "scope",
    "scrolling",
    "selected",
    "shape",
    "target",
    "text",
    "type",
    "valign",
    "valuetype",
    "vlink"
  ]);
  function shouldIgnoreCase(selector, options) {
    return typeof selector.ignoreCase === "boolean" ? selector.ignoreCase : selector.ignoreCase === "quirks" ? !!options.quirksMode : !options.xmlMode && caseInsensitiveAttributes.has(selector.name);
  }
  const attributeRules = {
    equals(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter2.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length === value.length && attr2.toLowerCase() === value && next2(elem);
        };
      }
      return (elem) => adapter2.getAttributeValue(elem, name2) === value && next2(elem);
    },
    hyphen(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = value.length;
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return function hyphenIC(elem) {
          const attr2 = adapter2.getAttributeValue(elem, name2);
          return attr2 != null && (attr2.length === len || attr2.charAt(len) === "-") && attr2.substr(0, len).toLowerCase() === value && next2(elem);
        };
      }
      return function hyphen(elem) {
        const attr2 = adapter2.getAttributeValue(elem, name2);
        return attr2 != null && (attr2.length === len || attr2.charAt(len) === "-") && attr2.substr(0, len) === value && next2(elem);
      };
    },
    element(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2, value } = data2;
      if (/\s/.test(value)) {
        return boolbase$1.falseFunc;
      }
      const regex = new RegExp(`(?:^|\\s)${escapeRegex(value)}(?:$|\\s)`, shouldIgnoreCase(data2, options) ? "i" : "");
      return function element(elem) {
        const attr2 = adapter2.getAttributeValue(elem, name2);
        return attr2 != null && attr2.length >= value.length && regex.test(attr2) && next2(elem);
      };
    },
    exists(next2, { name: name2 }, { adapter: adapter2 }) {
      return (elem) => adapter2.hasAttrib(elem, name2) && next2(elem);
    },
    start(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = value.length;
      if (len === 0) {
        return boolbase$1.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter2.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length >= len && attr2.substr(0, len).toLowerCase() === value && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter2.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.startsWith(value)) && next2(elem);
      };
    },
    end(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      const len = -value.length;
      if (len === 0) {
        return boolbase$1.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          var _a2;
          return ((_a2 = adapter2.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.substr(len).toLowerCase()) === value && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter2.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.endsWith(value)) && next2(elem);
      };
    },
    any(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2, value } = data2;
      if (value === "") {
        return boolbase$1.falseFunc;
      }
      if (shouldIgnoreCase(data2, options)) {
        const regex = new RegExp(escapeRegex(value), "i");
        return function anyIC(elem) {
          const attr2 = adapter2.getAttributeValue(elem, name2);
          return attr2 != null && attr2.length >= value.length && regex.test(attr2) && next2(elem);
        };
      }
      return (elem) => {
        var _a2;
        return !!((_a2 = adapter2.getAttributeValue(elem, name2)) === null || _a2 === void 0 ? void 0 : _a2.includes(value)) && next2(elem);
      };
    },
    not(next2, data2, options) {
      const { adapter: adapter2 } = options;
      const { name: name2 } = data2;
      let { value } = data2;
      if (value === "") {
        return (elem) => !!adapter2.getAttributeValue(elem, name2) && next2(elem);
      } else if (shouldIgnoreCase(data2, options)) {
        value = value.toLowerCase();
        return (elem) => {
          const attr2 = adapter2.getAttributeValue(elem, name2);
          return (attr2 == null || attr2.length !== value.length || attr2.toLowerCase() !== value) && next2(elem);
        };
      }
      return (elem) => adapter2.getAttributeValue(elem, name2) !== value && next2(elem);
    }
  };
  const whitespace = /* @__PURE__ */ new Set([9, 10, 12, 13, 32]);
  const ZERO = "0".charCodeAt(0);
  const NINE = "9".charCodeAt(0);
  function parse$3(formula) {
    formula = formula.trim().toLowerCase();
    if (formula === "even") {
      return [2, 0];
    } else if (formula === "odd") {
      return [2, 1];
    }
    let idx = 0;
    let a = 0;
    let sign = readSign();
    let number = readNumber();
    if (idx < formula.length && formula.charAt(idx) === "n") {
      idx++;
      a = sign * (number !== null && number !== void 0 ? number : 1);
      skipWhitespace();
      if (idx < formula.length) {
        sign = readSign();
        skipWhitespace();
        number = readNumber();
      } else {
        sign = number = 0;
      }
    }
    if (number === null || idx < formula.length) {
      throw new Error(`n-th rule couldn't be parsed ('${formula}')`);
    }
    return [a, sign * number];
    function readSign() {
      if (formula.charAt(idx) === "-") {
        idx++;
        return -1;
      }
      if (formula.charAt(idx) === "+") {
        idx++;
      }
      return 1;
    }
    function readNumber() {
      const start = idx;
      let value = 0;
      while (idx < formula.length && formula.charCodeAt(idx) >= ZERO && formula.charCodeAt(idx) <= NINE) {
        value = value * 10 + (formula.charCodeAt(idx) - ZERO);
        idx++;
      }
      return idx === start ? null : value;
    }
    function skipWhitespace() {
      while (idx < formula.length && whitespace.has(formula.charCodeAt(idx))) {
        idx++;
      }
    }
  }
  function compile(parsed) {
    const a = parsed[0];
    const b = parsed[1] - 1;
    if (b < 0 && a <= 0)
      return boolbase$1.falseFunc;
    if (a === -1)
      return (index2) => index2 <= b;
    if (a === 0)
      return (index2) => index2 === b;
    if (a === 1)
      return b < 0 ? boolbase$1.trueFunc : (index2) => index2 >= b;
    const absA = Math.abs(a);
    const bMod = (b % absA + absA) % absA;
    return a > 1 ? (index2) => index2 >= b && index2 % absA === bMod : (index2) => index2 <= b && index2 % absA === bMod;
  }
  function nthCheck(formula) {
    return compile(parse$3(formula));
  }
  function getChildFunc(next2, adapter2) {
    return (elem) => {
      const parent2 = adapter2.getParent(elem);
      return parent2 != null && adapter2.isTag(parent2) && next2(elem);
    };
  }
  const filters = {
    contains(next2, text2, { adapter: adapter2 }) {
      return function contains2(elem) {
        return next2(elem) && adapter2.getText(elem).includes(text2);
      };
    },
    icontains(next2, text2, { adapter: adapter2 }) {
      const itext = text2.toLowerCase();
      return function icontains(elem) {
        return next2(elem) && adapter2.getText(elem).toLowerCase().includes(itext);
      };
    },
    // Location specific methods
    "nth-child"(next2, rule, { adapter: adapter2, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase$1.falseFunc)
        return boolbase$1.falseFunc;
      if (func === boolbase$1.trueFunc)
        return getChildFunc(next2, adapter2);
      return function nthChild(elem) {
        const siblings2 = adapter2.getSiblings(elem);
        let pos = 0;
        for (let i2 = 0; i2 < siblings2.length; i2++) {
          if (equals(elem, siblings2[i2]))
            break;
          if (adapter2.isTag(siblings2[i2])) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-last-child"(next2, rule, { adapter: adapter2, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase$1.falseFunc)
        return boolbase$1.falseFunc;
      if (func === boolbase$1.trueFunc)
        return getChildFunc(next2, adapter2);
      return function nthLastChild(elem) {
        const siblings2 = adapter2.getSiblings(elem);
        let pos = 0;
        for (let i2 = siblings2.length - 1; i2 >= 0; i2--) {
          if (equals(elem, siblings2[i2]))
            break;
          if (adapter2.isTag(siblings2[i2])) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-of-type"(next2, rule, { adapter: adapter2, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase$1.falseFunc)
        return boolbase$1.falseFunc;
      if (func === boolbase$1.trueFunc)
        return getChildFunc(next2, adapter2);
      return function nthOfType(elem) {
        const siblings2 = adapter2.getSiblings(elem);
        let pos = 0;
        for (let i2 = 0; i2 < siblings2.length; i2++) {
          const currentSibling = siblings2[i2];
          if (equals(elem, currentSibling))
            break;
          if (adapter2.isTag(currentSibling) && adapter2.getName(currentSibling) === adapter2.getName(elem)) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    "nth-last-of-type"(next2, rule, { adapter: adapter2, equals }) {
      const func = nthCheck(rule);
      if (func === boolbase$1.falseFunc)
        return boolbase$1.falseFunc;
      if (func === boolbase$1.trueFunc)
        return getChildFunc(next2, adapter2);
      return function nthLastOfType(elem) {
        const siblings2 = adapter2.getSiblings(elem);
        let pos = 0;
        for (let i2 = siblings2.length - 1; i2 >= 0; i2--) {
          const currentSibling = siblings2[i2];
          if (equals(elem, currentSibling))
            break;
          if (adapter2.isTag(currentSibling) && adapter2.getName(currentSibling) === adapter2.getName(elem)) {
            pos++;
          }
        }
        return func(pos) && next2(elem);
      };
    },
    // TODO determine the actual root element
    root(next2, _rule, { adapter: adapter2 }) {
      return (elem) => {
        const parent2 = adapter2.getParent(elem);
        return (parent2 == null || !adapter2.isTag(parent2)) && next2(elem);
      };
    },
    scope(next2, rule, options, context) {
      const { equals } = options;
      if (!context || context.length === 0) {
        return filters["root"](next2, rule, options);
      }
      if (context.length === 1) {
        return (elem) => equals(context[0], elem) && next2(elem);
      }
      return (elem) => context.includes(elem) && next2(elem);
    },
    hover: dynamicStatePseudo("isHovered"),
    visited: dynamicStatePseudo("isVisited"),
    active: dynamicStatePseudo("isActive")
  };
  function dynamicStatePseudo(name2) {
    return function dynamicPseudo(next2, _rule, { adapter: adapter2 }) {
      const func = adapter2[name2];
      if (typeof func !== "function") {
        return boolbase$1.falseFunc;
      }
      return function active(elem) {
        return func(elem) && next2(elem);
      };
    };
  }
  const pseudos = {
    empty(elem, { adapter: adapter2 }) {
      return !adapter2.getChildren(elem).some((elem2) => (
        // FIXME: `getText` call is potentially expensive.
        adapter2.isTag(elem2) || adapter2.getText(elem2) !== ""
      ));
    },
    "first-child"(elem, { adapter: adapter2, equals }) {
      if (adapter2.prevElementSibling) {
        return adapter2.prevElementSibling(elem) == null;
      }
      const firstChild = adapter2.getSiblings(elem).find((elem2) => adapter2.isTag(elem2));
      return firstChild != null && equals(elem, firstChild);
    },
    "last-child"(elem, { adapter: adapter2, equals }) {
      const siblings2 = adapter2.getSiblings(elem);
      for (let i2 = siblings2.length - 1; i2 >= 0; i2--) {
        if (equals(elem, siblings2[i2]))
          return true;
        if (adapter2.isTag(siblings2[i2]))
          break;
      }
      return false;
    },
    "first-of-type"(elem, { adapter: adapter2, equals }) {
      const siblings2 = adapter2.getSiblings(elem);
      const elemName = adapter2.getName(elem);
      for (let i2 = 0; i2 < siblings2.length; i2++) {
        const currentSibling = siblings2[i2];
        if (equals(elem, currentSibling))
          return true;
        if (adapter2.isTag(currentSibling) && adapter2.getName(currentSibling) === elemName) {
          break;
        }
      }
      return false;
    },
    "last-of-type"(elem, { adapter: adapter2, equals }) {
      const siblings2 = adapter2.getSiblings(elem);
      const elemName = adapter2.getName(elem);
      for (let i2 = siblings2.length - 1; i2 >= 0; i2--) {
        const currentSibling = siblings2[i2];
        if (equals(elem, currentSibling))
          return true;
        if (adapter2.isTag(currentSibling) && adapter2.getName(currentSibling) === elemName) {
          break;
        }
      }
      return false;
    },
    "only-of-type"(elem, { adapter: adapter2, equals }) {
      const elemName = adapter2.getName(elem);
      return adapter2.getSiblings(elem).every((sibling) => equals(elem, sibling) || !adapter2.isTag(sibling) || adapter2.getName(sibling) !== elemName);
    },
    "only-child"(elem, { adapter: adapter2, equals }) {
      return adapter2.getSiblings(elem).every((sibling) => equals(elem, sibling) || !adapter2.isTag(sibling));
    }
  };
  function verifyPseudoArgs(func, name2, subselect, argIndex) {
    if (subselect === null) {
      if (func.length > argIndex) {
        throw new Error(`Pseudo-class :${name2} requires an argument`);
      }
    } else if (func.length === argIndex) {
      throw new Error(`Pseudo-class :${name2} doesn't have any arguments`);
    }
  }
  const aliases = {
    // Links
    "any-link": ":is(a, area, link)[href]",
    link: ":any-link:not(:visited)",
    // Forms
    // https://html.spec.whatwg.org/multipage/scripting.html#disabled-elements
    disabled: `:is(
        :is(button, input, select, textarea, optgroup, option)[disabled],
        optgroup[disabled] > option,
        fieldset[disabled]:not(fieldset[disabled] legend:first-of-type *)
    )`,
    enabled: ":not(:disabled)",
    checked: ":is(:is(input[type=radio], input[type=checkbox])[checked], option:selected)",
    required: ":is(input, select, textarea)[required]",
    optional: ":is(input, select, textarea):not([required])",
    // JQuery extensions
    // https://html.spec.whatwg.org/multipage/form-elements.html#concept-option-selectedness
    selected: "option:is([selected], select:not([multiple]):not(:has(> option[selected])) > :first-of-type)",
    checkbox: "[type=checkbox]",
    file: "[type=file]",
    password: "[type=password]",
    radio: "[type=radio]",
    reset: "[type=reset]",
    image: "[type=image]",
    submit: "[type=submit]",
    parent: ":not(:empty)",
    header: ":is(h1, h2, h3, h4, h5, h6)",
    button: ":is(button, input[type=button])",
    input: ":is(input, textarea, select, button)",
    text: "input:is(:not([type!='']), [type=text])"
  };
  const PLACEHOLDER_ELEMENT = {};
  function ensureIsTag(next2, adapter2) {
    if (next2 === boolbase$1.falseFunc)
      return boolbase$1.falseFunc;
    return (elem) => adapter2.isTag(elem) && next2(elem);
  }
  function getNextSiblings(elem, adapter2) {
    const siblings2 = adapter2.getSiblings(elem);
    if (siblings2.length <= 1)
      return [];
    const elemIndex = siblings2.indexOf(elem);
    if (elemIndex < 0 || elemIndex === siblings2.length - 1)
      return [];
    return siblings2.slice(elemIndex + 1).filter(adapter2.isTag);
  }
  function copyOptions(options) {
    return {
      xmlMode: !!options.xmlMode,
      lowerCaseAttributeNames: !!options.lowerCaseAttributeNames,
      lowerCaseTags: !!options.lowerCaseTags,
      quirksMode: !!options.quirksMode,
      cacheResults: !!options.cacheResults,
      pseudos: options.pseudos,
      adapter: options.adapter,
      equals: options.equals
    };
  }
  const is$2 = (next2, token, options, context, compileToken2) => {
    const func = compileToken2(token, copyOptions(options), context);
    return func === boolbase$1.trueFunc ? next2 : func === boolbase$1.falseFunc ? boolbase$1.falseFunc : (elem) => func(elem) && next2(elem);
  };
  const subselects = {
    is: is$2,
    /**
     * `:matches` and `:where` are aliases for `:is`.
     */
    matches: is$2,
    where: is$2,
    not(next2, token, options, context, compileToken2) {
      const func = compileToken2(token, copyOptions(options), context);
      return func === boolbase$1.falseFunc ? next2 : func === boolbase$1.trueFunc ? boolbase$1.falseFunc : (elem) => !func(elem) && next2(elem);
    },
    has(next2, subselect, options, _context, compileToken2) {
      const { adapter: adapter2 } = options;
      const opts = copyOptions(options);
      opts.relativeSelector = true;
      const context = subselect.some((s) => s.some(isTraversal)) ? (
        // Used as a placeholder. Will be replaced with the actual element.
        [PLACEHOLDER_ELEMENT]
      ) : void 0;
      const compiled = compileToken2(subselect, opts, context);
      if (compiled === boolbase$1.falseFunc)
        return boolbase$1.falseFunc;
      const hasElement = ensureIsTag(compiled, adapter2);
      if (context && compiled !== boolbase$1.trueFunc) {
        const { shouldTestNextSiblings = false } = compiled;
        return (elem) => {
          if (!next2(elem))
            return false;
          context[0] = elem;
          const childs = adapter2.getChildren(elem);
          const nextElements = shouldTestNextSiblings ? [...childs, ...getNextSiblings(elem, adapter2)] : childs;
          return adapter2.existsOne(hasElement, nextElements);
        };
      }
      return (elem) => next2(elem) && adapter2.existsOne(hasElement, adapter2.getChildren(elem));
    }
  };
  function compilePseudoSelector(next2, selector, options, context, compileToken2) {
    var _a2;
    const { name: name2, data: data2 } = selector;
    if (Array.isArray(data2)) {
      if (!(name2 in subselects)) {
        throw new Error(`Unknown pseudo-class :${name2}(${data2})`);
      }
      return subselects[name2](next2, data2, options, context, compileToken2);
    }
    const userPseudo = (_a2 = options.pseudos) === null || _a2 === void 0 ? void 0 : _a2[name2];
    const stringPseudo = typeof userPseudo === "string" ? userPseudo : aliases[name2];
    if (typeof stringPseudo === "string") {
      if (data2 != null) {
        throw new Error(`Pseudo ${name2} doesn't have any arguments`);
      }
      const alias = parse$4(stringPseudo);
      return subselects["is"](next2, alias, options, context, compileToken2);
    }
    if (typeof userPseudo === "function") {
      verifyPseudoArgs(userPseudo, name2, data2, 1);
      return (elem) => userPseudo(elem, data2) && next2(elem);
    }
    if (name2 in filters) {
      return filters[name2](next2, data2, options, context);
    }
    if (name2 in pseudos) {
      const pseudo = pseudos[name2];
      verifyPseudoArgs(pseudo, name2, data2, 2);
      return (elem) => pseudo(elem, options, data2) && next2(elem);
    }
    throw new Error(`Unknown pseudo-class :${name2}`);
  }
  function getElementParent(node, adapter2) {
    const parent2 = adapter2.getParent(node);
    if (parent2 && adapter2.isTag(parent2)) {
      return parent2;
    }
    return null;
  }
  function compileGeneralSelector(next2, selector, options, context, compileToken2) {
    const { adapter: adapter2, equals } = options;
    switch (selector.type) {
      case SelectorType.PseudoElement: {
        throw new Error("Pseudo-elements are not supported by css-select");
      }
      case SelectorType.ColumnCombinator: {
        throw new Error("Column combinators are not yet supported by css-select");
      }
      case SelectorType.Attribute: {
        if (selector.namespace != null) {
          throw new Error("Namespaced attributes are not yet supported by css-select");
        }
        if (!options.xmlMode || options.lowerCaseAttributeNames) {
          selector.name = selector.name.toLowerCase();
        }
        return attributeRules[selector.action](next2, selector, options);
      }
      case SelectorType.Pseudo: {
        return compilePseudoSelector(next2, selector, options, context, compileToken2);
      }
      case SelectorType.Tag: {
        if (selector.namespace != null) {
          throw new Error("Namespaced tag names are not yet supported by css-select");
        }
        let { name: name2 } = selector;
        if (!options.xmlMode || options.lowerCaseTags) {
          name2 = name2.toLowerCase();
        }
        return function tag(elem) {
          return adapter2.getName(elem) === name2 && next2(elem);
        };
      }
      case SelectorType.Descendant: {
        if (options.cacheResults === false || typeof WeakSet === "undefined") {
          return function descendant(elem) {
            let current = elem;
            while (current = getElementParent(current, adapter2)) {
              if (next2(current)) {
                return true;
              }
            }
            return false;
          };
        }
        const isFalseCache = /* @__PURE__ */ new WeakSet();
        return function cachedDescendant(elem) {
          let current = elem;
          while (current = getElementParent(current, adapter2)) {
            if (!isFalseCache.has(current)) {
              if (adapter2.isTag(current) && next2(current)) {
                return true;
              }
              isFalseCache.add(current);
            }
          }
          return false;
        };
      }
      case "_flexibleDescendant": {
        return function flexibleDescendant(elem) {
          let current = elem;
          do {
            if (next2(current))
              return true;
          } while (current = getElementParent(current, adapter2));
          return false;
        };
      }
      case SelectorType.Parent: {
        return function parent2(elem) {
          return adapter2.getChildren(elem).some((elem2) => adapter2.isTag(elem2) && next2(elem2));
        };
      }
      case SelectorType.Child: {
        return function child(elem) {
          const parent2 = adapter2.getParent(elem);
          return parent2 != null && adapter2.isTag(parent2) && next2(parent2);
        };
      }
      case SelectorType.Sibling: {
        return function sibling(elem) {
          const siblings2 = adapter2.getSiblings(elem);
          for (let i2 = 0; i2 < siblings2.length; i2++) {
            const currentSibling = siblings2[i2];
            if (equals(elem, currentSibling))
              break;
            if (adapter2.isTag(currentSibling) && next2(currentSibling)) {
              return true;
            }
          }
          return false;
        };
      }
      case SelectorType.Adjacent: {
        if (adapter2.prevElementSibling) {
          return function adjacent(elem) {
            const previous = adapter2.prevElementSibling(elem);
            return previous != null && next2(previous);
          };
        }
        return function adjacent(elem) {
          const siblings2 = adapter2.getSiblings(elem);
          let lastElement;
          for (let i2 = 0; i2 < siblings2.length; i2++) {
            const currentSibling = siblings2[i2];
            if (equals(elem, currentSibling))
              break;
            if (adapter2.isTag(currentSibling)) {
              lastElement = currentSibling;
            }
          }
          return !!lastElement && next2(lastElement);
        };
      }
      case SelectorType.Universal: {
        if (selector.namespace != null && selector.namespace !== "*") {
          throw new Error("Namespaced universal selectors are not yet supported by css-select");
        }
        return next2;
      }
    }
  }
  function includesScopePseudo(t) {
    return t.type === SelectorType.Pseudo && (t.name === "scope" || Array.isArray(t.data) && t.data.some((data2) => data2.some(includesScopePseudo)));
  }
  const DESCENDANT_TOKEN = { type: SelectorType.Descendant };
  const FLEXIBLE_DESCENDANT_TOKEN = {
    type: "_flexibleDescendant"
  };
  const SCOPE_TOKEN = {
    type: SelectorType.Pseudo,
    name: "scope",
    data: null
  };
  function absolutize(token, { adapter: adapter2 }, context) {
    const hasContext = !!(context === null || context === void 0 ? void 0 : context.every((e) => {
      const parent2 = adapter2.isTag(e) && adapter2.getParent(e);
      return e === PLACEHOLDER_ELEMENT || parent2 && adapter2.isTag(parent2);
    }));
    for (const t of token) {
      if (t.length > 0 && isTraversal(t[0]) && t[0].type !== SelectorType.Descendant)
        ;
      else if (hasContext && !t.some(includesScopePseudo)) {
        t.unshift(DESCENDANT_TOKEN);
      } else {
        continue;
      }
      t.unshift(SCOPE_TOKEN);
    }
  }
  function compileToken(token, options, context) {
    var _a2;
    token.forEach(sortByProcedure);
    context = (_a2 = options.context) !== null && _a2 !== void 0 ? _a2 : context;
    const isArrayContext = Array.isArray(context);
    const finalContext = context && (Array.isArray(context) ? context : [context]);
    if (options.relativeSelector !== false) {
      absolutize(token, options, finalContext);
    } else if (token.some((t) => t.length > 0 && isTraversal(t[0]))) {
      throw new Error("Relative selectors are not allowed when the `relativeSelector` option is disabled");
    }
    let shouldTestNextSiblings = false;
    const query = token.map((rules2) => {
      if (rules2.length >= 2) {
        const [first2, second] = rules2;
        if (first2.type !== SelectorType.Pseudo || first2.name !== "scope")
          ;
        else if (isArrayContext && second.type === SelectorType.Descendant) {
          rules2[1] = FLEXIBLE_DESCENDANT_TOKEN;
        } else if (second.type === SelectorType.Adjacent || second.type === SelectorType.Sibling) {
          shouldTestNextSiblings = true;
        }
      }
      return compileRules(rules2, options, finalContext);
    }).reduce(reduceRules, boolbase$1.falseFunc);
    query.shouldTestNextSiblings = shouldTestNextSiblings;
    return query;
  }
  function compileRules(rules2, options, context) {
    var _a2;
    return rules2.reduce((previous, rule) => previous === boolbase$1.falseFunc ? boolbase$1.falseFunc : compileGeneralSelector(previous, rule, options, context, compileToken), (_a2 = options.rootFunc) !== null && _a2 !== void 0 ? _a2 : boolbase$1.trueFunc);
  }
  function reduceRules(a, b) {
    if (b === boolbase$1.falseFunc || a === boolbase$1.trueFunc) {
      return a;
    }
    if (a === boolbase$1.falseFunc || b === boolbase$1.trueFunc) {
      return b;
    }
    return function combine(elem) {
      return a(elem) || b(elem);
    };
  }
  const defaultEquals = (a, b) => a === b;
  const defaultOptions$1 = {
    adapter: DomUtils,
    equals: defaultEquals
  };
  function convertOptionFormats(options) {
    var _a2, _b, _c, _d;
    const opts = options !== null && options !== void 0 ? options : defaultOptions$1;
    (_a2 = opts.adapter) !== null && _a2 !== void 0 ? _a2 : opts.adapter = DomUtils;
    (_b = opts.equals) !== null && _b !== void 0 ? _b : opts.equals = (_d = (_c = opts.adapter) === null || _c === void 0 ? void 0 : _c.equals) !== null && _d !== void 0 ? _d : defaultEquals;
    return opts;
  }
  function wrapCompile(func) {
    return function addAdapter(selector, options, context) {
      const opts = convertOptionFormats(options);
      return func(selector, opts, context);
    };
  }
  const _compileToken = wrapCompile(compileToken);
  function prepareContext(elems, adapter2, shouldTestNextSiblings = false) {
    if (shouldTestNextSiblings) {
      elems = appendNextSiblings(elems, adapter2);
    }
    return Array.isArray(elems) ? adapter2.removeSubsets(elems) : adapter2.getChildren(elems);
  }
  function appendNextSiblings(elem, adapter2) {
    const elems = Array.isArray(elem) ? elem.slice(0) : [elem];
    const elemsLength = elems.length;
    for (let i2 = 0; i2 < elemsLength; i2++) {
      const nextSiblings = getNextSiblings(elems[i2], adapter2);
      elems.push(...nextSiblings);
    }
    return elems;
  }
  const filterNames = /* @__PURE__ */ new Set([
    "first",
    "last",
    "eq",
    "gt",
    "nth",
    "lt",
    "even",
    "odd"
  ]);
  function isFilter(s) {
    if (s.type !== "pseudo")
      return false;
    if (filterNames.has(s.name))
      return true;
    if (s.name === "not" && Array.isArray(s.data)) {
      return s.data.some((s2) => s2.some(isFilter));
    }
    return false;
  }
  function getLimit(filter2, data2, partLimit) {
    const num = data2 != null ? parseInt(data2, 10) : NaN;
    switch (filter2) {
      case "first":
        return 1;
      case "nth":
      case "eq":
        return isFinite(num) ? num >= 0 ? num + 1 : Infinity : 0;
      case "lt":
        return isFinite(num) ? num >= 0 ? Math.min(num, partLimit) : Infinity : 0;
      case "gt":
        return isFinite(num) ? Infinity : 0;
      case "odd":
        return 2 * partLimit;
      case "even":
        return 2 * partLimit - 1;
      case "last":
      case "not":
        return Infinity;
    }
  }
  function getDocumentRoot(node) {
    while (node.parent)
      node = node.parent;
    return node;
  }
  function groupSelectors(selectors) {
    const filteredSelectors = [];
    const plainSelectors = [];
    for (const selector of selectors) {
      if (selector.some(isFilter)) {
        filteredSelectors.push(selector);
      } else {
        plainSelectors.push(selector);
      }
    }
    return [plainSelectors, filteredSelectors];
  }
  const UNIVERSAL_SELECTOR = {
    type: SelectorType.Universal,
    namespace: null
  };
  const SCOPE_PSEUDO = {
    type: SelectorType.Pseudo,
    name: "scope",
    data: null
  };
  function is$1(element, selector, options = {}) {
    return some([element], selector, options);
  }
  function some(elements, selector, options = {}) {
    if (typeof selector === "function")
      return elements.some(selector);
    const [plain, filtered] = groupSelectors(parse$4(selector));
    return plain.length > 0 && elements.some(_compileToken(plain, options)) || filtered.some((sel) => filterBySelector(sel, elements, options).length > 0);
  }
  function filterByPosition(filter2, elems, data2, options) {
    const num = typeof data2 === "string" ? parseInt(data2, 10) : NaN;
    switch (filter2) {
      case "first":
      case "lt":
        return elems;
      case "last":
        return elems.length > 0 ? [elems[elems.length - 1]] : elems;
      case "nth":
      case "eq":
        return isFinite(num) && Math.abs(num) < elems.length ? [num < 0 ? elems[elems.length + num] : elems[num]] : [];
      case "gt":
        return isFinite(num) ? elems.slice(num + 1) : [];
      case "even":
        return elems.filter((_, i2) => i2 % 2 === 0);
      case "odd":
        return elems.filter((_, i2) => i2 % 2 === 1);
      case "not": {
        const filtered = new Set(filterParsed(data2, elems, options));
        return elems.filter((e) => !filtered.has(e));
      }
    }
  }
  function filter$1(selector, elements, options = {}) {
    return filterParsed(parse$4(selector), elements, options);
  }
  function filterParsed(selector, elements, options) {
    if (elements.length === 0)
      return [];
    const [plainSelectors, filteredSelectors] = groupSelectors(selector);
    let found;
    if (plainSelectors.length) {
      const filtered = filterElements(elements, plainSelectors, options);
      if (filteredSelectors.length === 0) {
        return filtered;
      }
      if (filtered.length) {
        found = new Set(filtered);
      }
    }
    for (let i2 = 0; i2 < filteredSelectors.length && (found === null || found === void 0 ? void 0 : found.size) !== elements.length; i2++) {
      const filteredSelector = filteredSelectors[i2];
      const missing = found ? elements.filter((e) => isTag(e) && !found.has(e)) : elements;
      if (missing.length === 0)
        break;
      const filtered = filterBySelector(filteredSelector, elements, options);
      if (filtered.length) {
        if (!found) {
          if (i2 === filteredSelectors.length - 1) {
            return filtered;
          }
          found = new Set(filtered);
        } else {
          filtered.forEach((el) => found.add(el));
        }
      }
    }
    return typeof found !== "undefined" ? found.size === elements.length ? elements : (
      // Filter elements to preserve order
      elements.filter((el) => found.has(el))
    ) : [];
  }
  function filterBySelector(selector, elements, options) {
    var _a2;
    if (selector.some(isTraversal$1)) {
      const root2 = (_a2 = options.root) !== null && _a2 !== void 0 ? _a2 : getDocumentRoot(elements[0]);
      const opts = { ...options, context: elements, relativeSelector: false };
      selector.push(SCOPE_PSEUDO);
      return findFilterElements(root2, selector, opts, true, elements.length);
    }
    return findFilterElements(elements, selector, options, false, elements.length);
  }
  function select(selector, root2, options = {}, limit = Infinity) {
    if (typeof selector === "function") {
      return find$1(root2, selector);
    }
    const [plain, filtered] = groupSelectors(parse$4(selector));
    const results = filtered.map((sel) => findFilterElements(root2, sel, options, true, limit));
    if (plain.length) {
      results.push(findElements(root2, plain, options, limit));
    }
    if (results.length === 0) {
      return [];
    }
    if (results.length === 1) {
      return results[0];
    }
    return uniqueSort(results.reduce((a, b) => [...a, ...b]));
  }
  function findFilterElements(root2, selector, options, queryForSelector, totalLimit) {
    const filterIndex = selector.findIndex(isFilter);
    const sub2 = selector.slice(0, filterIndex);
    const filter2 = selector[filterIndex];
    const partLimit = selector.length - 1 === filterIndex ? totalLimit : Infinity;
    const limit = getLimit(filter2.name, filter2.data, partLimit);
    if (limit === 0)
      return [];
    const elemsNoLimit = sub2.length === 0 && !Array.isArray(root2) ? getChildren(root2).filter(isTag) : sub2.length === 0 ? (Array.isArray(root2) ? root2 : [root2]).filter(isTag) : queryForSelector || sub2.some(isTraversal$1) ? findElements(root2, [sub2], options, limit) : filterElements(root2, [sub2], options);
    const elems = elemsNoLimit.slice(0, limit);
    let result = filterByPosition(filter2.name, elems, filter2.data, options);
    if (result.length === 0 || selector.length === filterIndex + 1) {
      return result;
    }
    const remainingSelector = selector.slice(filterIndex + 1);
    const remainingHasTraversal = remainingSelector.some(isTraversal$1);
    if (remainingHasTraversal) {
      if (isTraversal$1(remainingSelector[0])) {
        const { type: type2 } = remainingSelector[0];
        if (type2 === SelectorType.Sibling || type2 === SelectorType.Adjacent) {
          result = prepareContext(result, DomUtils, true);
        }
        remainingSelector.unshift(UNIVERSAL_SELECTOR);
      }
      options = {
        ...options,
        // Avoid absolutizing the selector
        relativeSelector: false,
        /*
         * Add a custom root func, to make sure traversals don't match elements
         * that aren't a part of the considered tree.
         */
        rootFunc: (el) => result.includes(el)
      };
    } else if (options.rootFunc && options.rootFunc !== boolbase.trueFunc) {
      options = { ...options, rootFunc: boolbase.trueFunc };
    }
    return remainingSelector.some(isFilter) ? findFilterElements(result, remainingSelector, options, false, totalLimit) : remainingHasTraversal ? (
      // Query existing elements to resolve traversal.
      findElements(result, [remainingSelector], options, totalLimit)
    ) : (
      // If we don't have any more traversals, simply filter elements.
      filterElements(result, [remainingSelector], options)
    );
  }
  function findElements(root2, sel, options, limit) {
    const query = _compileToken(sel, options, root2);
    return find$1(root2, query, limit);
  }
  function find$1(root2, query, limit = Infinity) {
    const elems = prepareContext(root2, DomUtils, query.shouldTestNextSiblings);
    return find$2((node) => isTag(node) && query(node), elems, true, limit);
  }
  function filterElements(elements, sel, options) {
    const els = (Array.isArray(elements) ? elements : [elements]).filter(isTag);
    if (els.length === 0)
      return els;
    const query = _compileToken(sel, options);
    return query === boolbase.trueFunc ? els : els.filter(query);
  }
  const reSiblingSelector = /^\s*[~+]/;
  function find(selectorOrHaystack) {
    var _a2;
    if (!selectorOrHaystack) {
      return this._make([]);
    }
    const context = this.toArray();
    if (typeof selectorOrHaystack !== "string") {
      const haystack = isCheerio(selectorOrHaystack) ? selectorOrHaystack.toArray() : [selectorOrHaystack];
      return this._make(haystack.filter((elem) => context.some((node) => contains(node, elem))));
    }
    const elems = reSiblingSelector.test(selectorOrHaystack) ? context : this.children().toArray();
    const options = {
      context,
      root: (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0],
      // Pass options that are recognized by `cheerio-select`
      xmlMode: this.options.xmlMode,
      lowerCaseTags: this.options.lowerCaseTags,
      lowerCaseAttributeNames: this.options.lowerCaseAttributeNames,
      pseudos: this.options.pseudos,
      quirksMode: this.options.quirksMode
    };
    return this._make(select(selectorOrHaystack, elems, options));
  }
  function _getMatcher(matchMap) {
    return function(fn, ...postFns) {
      return function(selector) {
        var _a2;
        let matched = matchMap(fn, this);
        if (selector) {
          matched = filterArray(matched, selector, this.options.xmlMode, (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]);
        }
        return this._make(
          // Post processing is only necessary if there is more than one element.
          this.length > 1 && matched.length > 1 ? postFns.reduce((elems, fn2) => fn2(elems), matched) : matched
        );
      };
    };
  }
  const _matcher = _getMatcher((fn, elems) => {
    const ret = [];
    for (let i2 = 0; i2 < elems.length; i2++) {
      const value = fn(elems[i2]);
      ret.push(value);
    }
    return new Array().concat(...ret);
  });
  const _singleMatcher = _getMatcher((fn, elems) => {
    const ret = [];
    for (let i2 = 0; i2 < elems.length; i2++) {
      const value = fn(elems[i2]);
      if (value !== null) {
        ret.push(value);
      }
    }
    return ret;
  });
  function _matchUntil(nextElem, ...postFns) {
    let matches = null;
    const innerMatcher = _getMatcher((nextElem2, elems) => {
      const matched = [];
      domEach(elems, (elem) => {
        for (let next2; next2 = nextElem2(elem); elem = next2) {
          if (matches === null || matches === void 0 ? void 0 : matches(next2, matched.length))
            break;
          matched.push(next2);
        }
      });
      return matched;
    })(nextElem, ...postFns);
    return function(selector, filterSelector) {
      matches = typeof selector === "string" ? (elem) => is$1(elem, selector, this.options) : selector ? getFilterFn(selector) : null;
      const ret = innerMatcher.call(this, filterSelector);
      matches = null;
      return ret;
    };
  }
  function _removeDuplicates(elems) {
    return Array.from(new Set(elems));
  }
  const parent = _singleMatcher(({ parent: parent2 }) => parent2 && !isDocument(parent2) ? parent2 : null, _removeDuplicates);
  const parents = _matcher((elem) => {
    const matched = [];
    while (elem.parent && !isDocument(elem.parent)) {
      matched.push(elem.parent);
      elem = elem.parent;
    }
    return matched;
  }, uniqueSort, (elems) => elems.reverse());
  const parentsUntil = _matchUntil(({ parent: parent2 }) => parent2 && !isDocument(parent2) ? parent2 : null, uniqueSort, (elems) => elems.reverse());
  function closest(selector) {
    var _a2;
    const set2 = [];
    if (!selector) {
      return this._make(set2);
    }
    const selectOpts = {
      xmlMode: this.options.xmlMode,
      root: (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]
    };
    const selectFn = typeof selector === "string" ? (elem) => is$1(elem, selector, selectOpts) : getFilterFn(selector);
    domEach(this, (elem) => {
      while (elem && isTag(elem)) {
        if (selectFn(elem, 0)) {
          if (!set2.includes(elem)) {
            set2.push(elem);
          }
          break;
        }
        elem = elem.parent;
      }
    });
    return this._make(set2);
  }
  const next = _singleMatcher((elem) => nextElementSibling(elem));
  const nextAll = _matcher((elem) => {
    const matched = [];
    while (elem.next) {
      elem = elem.next;
      if (isTag(elem))
        matched.push(elem);
    }
    return matched;
  }, _removeDuplicates);
  const nextUntil = _matchUntil((el) => nextElementSibling(el), _removeDuplicates);
  const prev = _singleMatcher((elem) => prevElementSibling(elem));
  const prevAll = _matcher((elem) => {
    const matched = [];
    while (elem.prev) {
      elem = elem.prev;
      if (isTag(elem))
        matched.push(elem);
    }
    return matched;
  }, _removeDuplicates);
  const prevUntil = _matchUntil((el) => prevElementSibling(el), _removeDuplicates);
  const siblings = _matcher((elem) => getSiblings(elem).filter((el) => isTag(el) && el !== elem), uniqueSort);
  const children = _matcher((elem) => getChildren(elem).filter(isTag), _removeDuplicates);
  function contents() {
    const elems = this.toArray().reduce((newElems, elem) => hasChildren(elem) ? newElems.concat(elem.children) : newElems, []);
    return this._make(elems);
  }
  function each(fn) {
    let i2 = 0;
    const len = this.length;
    while (i2 < len && fn.call(this[i2], i2, this[i2]) !== false)
      ++i2;
    return this;
  }
  function map$1(fn) {
    let elems = [];
    for (let i2 = 0; i2 < this.length; i2++) {
      const el = this[i2];
      const val2 = fn.call(el, i2, el);
      if (val2 != null) {
        elems = elems.concat(val2);
      }
    }
    return this._make(elems);
  }
  function getFilterFn(match) {
    if (typeof match === "function") {
      return (el, i2) => match.call(el, i2, el);
    }
    if (isCheerio(match)) {
      return (el) => Array.prototype.includes.call(match, el);
    }
    return function(el) {
      return match === el;
    };
  }
  function filter(match) {
    var _a2;
    return this._make(filterArray(this.toArray(), match, this.options.xmlMode, (_a2 = this._root) === null || _a2 === void 0 ? void 0 : _a2[0]));
  }
  function filterArray(nodes, match, xmlMode, root2) {
    return typeof match === "string" ? filter$1(match, nodes, { xmlMode, root: root2 }) : nodes.filter(getFilterFn(match));
  }
  function is(selector) {
    const nodes = this.toArray();
    return typeof selector === "string" ? some(nodes.filter(isTag), selector, this.options) : selector ? nodes.some(getFilterFn(selector)) : false;
  }
  function not(match) {
    let nodes = this.toArray();
    if (typeof match === "string") {
      const matches = new Set(filter$1(match, nodes, this.options));
      nodes = nodes.filter((el) => !matches.has(el));
    } else {
      const filterFn = getFilterFn(match);
      nodes = nodes.filter((el, i2) => !filterFn(el, i2));
    }
    return this._make(nodes);
  }
  function has$1(selectorOrHaystack) {
    return this.filter(typeof selectorOrHaystack === "string" ? (
      // Using the `:has` selector here short-circuits searches.
      `:has(${selectorOrHaystack})`
    ) : (_, el) => this._make(el).find(selectorOrHaystack).length > 0);
  }
  function first() {
    return this.length > 1 ? this._make(this[0]) : this;
  }
  function last() {
    return this.length > 0 ? this._make(this[this.length - 1]) : this;
  }
  function eq(i2) {
    var _a2;
    i2 = +i2;
    if (i2 === 0 && this.length <= 1)
      return this;
    if (i2 < 0)
      i2 = this.length + i2;
    return this._make((_a2 = this[i2]) !== null && _a2 !== void 0 ? _a2 : []);
  }
  function get(i2) {
    if (i2 == null) {
      return this.toArray();
    }
    return this[i2 < 0 ? this.length + i2 : i2];
  }
  function toArray$1() {
    return Array.prototype.slice.call(this);
  }
  function index(selectorOrNeedle) {
    let $haystack;
    let needle;
    if (selectorOrNeedle == null) {
      $haystack = this.parent().children();
      needle = this[0];
    } else if (typeof selectorOrNeedle === "string") {
      $haystack = this._make(selectorOrNeedle);
      needle = this[0];
    } else {
      $haystack = this;
      needle = isCheerio(selectorOrNeedle) ? selectorOrNeedle[0] : selectorOrNeedle;
    }
    return Array.prototype.indexOf.call($haystack, needle);
  }
  function slice(start, end2) {
    return this._make(Array.prototype.slice.call(this, start, end2));
  }
  function end() {
    var _a2;
    return (_a2 = this.prevObject) !== null && _a2 !== void 0 ? _a2 : this._make([]);
  }
  function add(other, context) {
    const selection = this._make(other, context);
    const contents2 = uniqueSort([...this.get(), ...selection.get()]);
    return this._make(contents2);
  }
  function addBack(selector) {
    return this.prevObject ? this.add(selector ? this.prevObject.filter(selector) : this.prevObject) : this;
  }
  const Traversing = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    add,
    addBack,
    children,
    closest,
    contents,
    each,
    end,
    eq,
    filter,
    filterArray,
    find,
    first,
    get,
    has: has$1,
    index,
    is,
    last,
    map: map$1,
    next,
    nextAll,
    nextUntil,
    not,
    parent,
    parents,
    parentsUntil,
    prev,
    prevAll,
    prevUntil,
    siblings,
    slice,
    toArray: toArray$1
  }, Symbol.toStringTag, { value: "Module" }));
  function getParse(parser) {
    return function parse2(content, options, isDocument$1, context) {
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(content)) {
        content = content.toString();
      }
      if (typeof content === "string") {
        return parser(content, options, isDocument$1, context);
      }
      const doc = content;
      if (!Array.isArray(doc) && isDocument(doc)) {
        return doc;
      }
      const root2 = new Document([]);
      update(doc, root2);
      return root2;
    };
  }
  function update(newChilds, parent2) {
    const arr = Array.isArray(newChilds) ? newChilds : [newChilds];
    if (parent2) {
      parent2.children = arr;
    } else {
      parent2 = null;
    }
    for (let i2 = 0; i2 < arr.length; i2++) {
      const node = arr[i2];
      if (node.parent && node.parent.children !== arr) {
        removeElement(node);
      }
      if (parent2) {
        node.prev = arr[i2 - 1] || null;
        node.next = arr[i2 + 1] || null;
      } else {
        node.prev = node.next = null;
      }
      node.parent = parent2;
    }
    return parent2;
  }
  function _makeDomArray(elem, clone2) {
    if (elem == null) {
      return [];
    }
    if (isCheerio(elem)) {
      return clone2 ? cloneDom(elem.get()) : elem.get();
    }
    if (Array.isArray(elem)) {
      return elem.reduce((newElems, el) => newElems.concat(this._makeDomArray(el, clone2)), []);
    }
    if (typeof elem === "string") {
      return this._parse(elem, this.options, false, null).children;
    }
    return clone2 ? cloneDom([elem]) : [elem];
  }
  function _insert(concatenator) {
    return function(...elems) {
      const lastIdx = this.length - 1;
      return domEach(this, (el, i2) => {
        if (!hasChildren(el))
          return;
        const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i2, this._render(el.children)) : elems;
        const dom = this._makeDomArray(domSrc, i2 < lastIdx);
        concatenator(dom, el.children, el);
      });
    };
  }
  function uniqueSplice(array, spliceIdx, spliceCount, newElems, parent2) {
    var _a2, _b;
    const spliceArgs = [
      spliceIdx,
      spliceCount,
      ...newElems
    ];
    const prev2 = spliceIdx === 0 ? null : array[spliceIdx - 1];
    const next2 = spliceIdx + spliceCount >= array.length ? null : array[spliceIdx + spliceCount];
    for (let idx = 0; idx < newElems.length; ++idx) {
      const node = newElems[idx];
      const oldParent = node.parent;
      if (oldParent) {
        const oldSiblings = oldParent.children;
        const prevIdx = oldSiblings.indexOf(node);
        if (prevIdx > -1) {
          oldParent.children.splice(prevIdx, 1);
          if (parent2 === oldParent && spliceIdx > prevIdx) {
            spliceArgs[0]--;
          }
        }
      }
      node.parent = parent2;
      if (node.prev) {
        node.prev.next = (_a2 = node.next) !== null && _a2 !== void 0 ? _a2 : null;
      }
      if (node.next) {
        node.next.prev = (_b = node.prev) !== null && _b !== void 0 ? _b : null;
      }
      node.prev = idx === 0 ? prev2 : newElems[idx - 1];
      node.next = idx === newElems.length - 1 ? next2 : newElems[idx + 1];
    }
    if (prev2) {
      prev2.next = newElems[0];
    }
    if (next2) {
      next2.prev = newElems[newElems.length - 1];
    }
    return array.splice(...spliceArgs);
  }
  function appendTo(target) {
    const appendTarget = isCheerio(target) ? target : this._make(target);
    appendTarget.append(this);
    return this;
  }
  function prependTo(target) {
    const prependTarget = isCheerio(target) ? target : this._make(target);
    prependTarget.prepend(this);
    return this;
  }
  const append = _insert((dom, children2, parent2) => {
    uniqueSplice(children2, children2.length, 0, dom, parent2);
  });
  const prepend = _insert((dom, children2, parent2) => {
    uniqueSplice(children2, 0, 0, dom, parent2);
  });
  function _wrap(insert) {
    return function(wrapper) {
      const lastIdx = this.length - 1;
      const lastParent = this.parents().last();
      for (let i2 = 0; i2 < this.length; i2++) {
        const el = this[i2];
        const wrap2 = typeof wrapper === "function" ? wrapper.call(el, i2, el) : typeof wrapper === "string" && !isHtml(wrapper) ? lastParent.find(wrapper).clone() : wrapper;
        const [wrapperDom] = this._makeDomArray(wrap2, i2 < lastIdx);
        if (!wrapperDom || !hasChildren(wrapperDom))
          continue;
        let elInsertLocation = wrapperDom;
        let j = 0;
        while (j < elInsertLocation.children.length) {
          const child = elInsertLocation.children[j];
          if (isTag(child)) {
            elInsertLocation = child;
            j = 0;
          } else {
            j++;
          }
        }
        insert(el, elInsertLocation, [wrapperDom]);
      }
      return this;
    };
  }
  const wrap = _wrap((el, elInsertLocation, wrapperDom) => {
    const { parent: parent2 } = el;
    if (!parent2)
      return;
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    update([el], elInsertLocation);
    uniqueSplice(siblings2, index2, 0, wrapperDom, parent2);
  });
  const wrapInner = _wrap((el, elInsertLocation, wrapperDom) => {
    if (!hasChildren(el))
      return;
    update(el.children, elInsertLocation);
    update(wrapperDom, el);
  });
  function unwrap(selector) {
    this.parent(selector).not("body").each((_, el) => {
      this._make(el).replaceWith(el.children);
    });
    return this;
  }
  function wrapAll(wrapper) {
    const el = this[0];
    if (el) {
      const wrap2 = this._make(typeof wrapper === "function" ? wrapper.call(el, 0, el) : wrapper).insertBefore(el);
      let elInsertLocation;
      for (let i2 = 0; i2 < wrap2.length; i2++) {
        if (wrap2[i2].type === "tag")
          elInsertLocation = wrap2[i2];
      }
      let j = 0;
      while (elInsertLocation && j < elInsertLocation.children.length) {
        const child = elInsertLocation.children[j];
        if (child.type === "tag") {
          elInsertLocation = child;
          j = 0;
        } else {
          j++;
        }
      }
      if (elInsertLocation)
        this._make(elInsertLocation).append(this);
    }
    return this;
  }
  function after(...elems) {
    const lastIdx = this.length - 1;
    return domEach(this, (el, i2) => {
      const { parent: parent2 } = el;
      if (!hasChildren(el) || !parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i2, this._render(el.children)) : elems;
      const dom = this._makeDomArray(domSrc, i2 < lastIdx);
      uniqueSplice(siblings2, index2 + 1, 0, dom, parent2);
    });
  }
  function insertAfter(target) {
    if (typeof target === "string") {
      target = this._make(target);
    }
    this.remove();
    const clones = [];
    this._makeDomArray(target).forEach((el) => {
      const clonedSelf = this.clone().toArray();
      const { parent: parent2 } = el;
      if (!parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      uniqueSplice(siblings2, index2 + 1, 0, clonedSelf, parent2);
      clones.push(...clonedSelf);
    });
    return this._make(clones);
  }
  function before(...elems) {
    const lastIdx = this.length - 1;
    return domEach(this, (el, i2) => {
      const { parent: parent2 } = el;
      if (!hasChildren(el) || !parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i2, this._render(el.children)) : elems;
      const dom = this._makeDomArray(domSrc, i2 < lastIdx);
      uniqueSplice(siblings2, index2, 0, dom, parent2);
    });
  }
  function insertBefore(target) {
    const targetArr = this._make(target);
    this.remove();
    const clones = [];
    domEach(targetArr, (el) => {
      const clonedSelf = this.clone().toArray();
      const { parent: parent2 } = el;
      if (!parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const index2 = siblings2.indexOf(el);
      if (index2 < 0)
        return;
      uniqueSplice(siblings2, index2, 0, clonedSelf, parent2);
      clones.push(...clonedSelf);
    });
    return this._make(clones);
  }
  function remove(selector) {
    const elems = selector ? this.filter(selector) : this;
    domEach(elems, (el) => {
      removeElement(el);
      el.prev = el.next = el.parent = null;
    });
    return this;
  }
  function replaceWith(content) {
    return domEach(this, (el, i2) => {
      const { parent: parent2 } = el;
      if (!parent2) {
        return;
      }
      const siblings2 = parent2.children;
      const cont = typeof content === "function" ? content.call(el, i2, el) : content;
      const dom = this._makeDomArray(cont);
      update(dom, null);
      const index2 = siblings2.indexOf(el);
      uniqueSplice(siblings2, index2, 1, dom, parent2);
      if (!dom.includes(el)) {
        el.parent = el.prev = el.next = null;
      }
    });
  }
  function empty() {
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      el.children.forEach((child) => {
        child.next = child.prev = child.parent = null;
      });
      el.children.length = 0;
    });
  }
  function html(str2) {
    if (str2 === void 0) {
      const el = this[0];
      if (!el || !hasChildren(el))
        return null;
      return this._render(el.children);
    }
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      el.children.forEach((child) => {
        child.next = child.prev = child.parent = null;
      });
      const content = isCheerio(str2) ? str2.toArray() : this._parse(`${str2}`, this.options, false, el).children;
      update(content, el);
    });
  }
  function toString() {
    return this._render(this);
  }
  function text$1(str2) {
    if (str2 === void 0) {
      return text$2(this);
    }
    if (typeof str2 === "function") {
      return domEach(this, (el, i2) => this._make(el).text(str2.call(el, i2, text$2([el]))));
    }
    return domEach(this, (el) => {
      if (!hasChildren(el))
        return;
      el.children.forEach((child) => {
        child.next = child.prev = child.parent = null;
      });
      const textNode = new Text(`${str2}`);
      update(textNode, el);
    });
  }
  function clone() {
    return this._make(cloneDom(this.get()));
  }
  const Manipulation = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    _makeDomArray,
    after,
    append,
    appendTo,
    before,
    clone,
    empty,
    html,
    insertAfter,
    insertBefore,
    prepend,
    prependTo,
    remove,
    replaceWith,
    text: text$1,
    toString,
    unwrap,
    wrap,
    wrapAll,
    wrapInner
  }, Symbol.toStringTag, { value: "Module" }));
  function css(prop2, val2) {
    if (prop2 != null && val2 != null || // When `prop` is a "plain" object
    typeof prop2 === "object" && !Array.isArray(prop2)) {
      return domEach(this, (el, i2) => {
        if (isTag(el)) {
          setCss(el, prop2, val2, i2);
        }
      });
    }
    if (this.length === 0) {
      return void 0;
    }
    return getCss(this[0], prop2);
  }
  function setCss(el, prop2, value, idx) {
    if (typeof prop2 === "string") {
      const styles2 = getCss(el);
      const val2 = typeof value === "function" ? value.call(el, idx, styles2[prop2]) : value;
      if (val2 === "") {
        delete styles2[prop2];
      } else if (val2 != null) {
        styles2[prop2] = val2;
      }
      el.attribs["style"] = stringify(styles2);
    } else if (typeof prop2 === "object") {
      Object.keys(prop2).forEach((k, i2) => {
        setCss(el, k, prop2[k], i2);
      });
    }
  }
  function getCss(el, prop2) {
    if (!el || !isTag(el))
      return;
    const styles2 = parse$2(el.attribs["style"]);
    if (typeof prop2 === "string") {
      return styles2[prop2];
    }
    if (Array.isArray(prop2)) {
      const newStyles = {};
      prop2.forEach((item) => {
        if (styles2[item] != null) {
          newStyles[item] = styles2[item];
        }
      });
      return newStyles;
    }
    return styles2;
  }
  function stringify(obj) {
    return Object.keys(obj).reduce((str2, prop2) => `${str2}${str2 ? " " : ""}${prop2}: ${obj[prop2]};`, "");
  }
  function parse$2(styles2) {
    styles2 = (styles2 || "").trim();
    if (!styles2)
      return {};
    const obj = {};
    let key;
    for (const str2 of styles2.split(";")) {
      const n = str2.indexOf(":");
      if (n < 1 || n === str2.length - 1) {
        const trimmed = str2.trimEnd();
        if (trimmed.length > 0 && key !== void 0) {
          obj[key] += `;${trimmed}`;
        }
      } else {
        key = str2.slice(0, n).trim();
        obj[key] = str2.slice(n + 1).trim();
      }
    }
    return obj;
  }
  const Css = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    css
  }, Symbol.toStringTag, { value: "Module" }));
  const submittableSelector = "input,select,textarea,keygen";
  const r20 = /%20/g;
  const rCRLF = /\r?\n/g;
  function serialize() {
    const arr = this.serializeArray();
    const retArr = arr.map((data2) => `${encodeURIComponent(data2.name)}=${encodeURIComponent(data2.value)}`);
    return retArr.join("&").replace(r20, "+");
  }
  function serializeArray() {
    return this.map((_, elem) => {
      const $elem = this._make(elem);
      if (isTag(elem) && elem.name === "form") {
        return $elem.find(submittableSelector).toArray();
      }
      return $elem.filter(submittableSelector).toArray();
    }).filter(
      // Verify elements have a name (`attr.name`) and are not disabled (`:enabled`)
      '[name!=""]:enabled:not(:submit, :button, :image, :reset, :file):matches([checked], :not(:checkbox, :radio))'
      // Convert each of the elements to its value(s)
    ).map((_, elem) => {
      var _a2;
      const $elem = this._make(elem);
      const name2 = $elem.attr("name");
      const value = (_a2 = $elem.val()) !== null && _a2 !== void 0 ? _a2 : "";
      if (Array.isArray(value)) {
        return value.map((val2) => (
          /*
           * We trim replace any line endings (e.g. `\r` or `\r\n` with `\r\n`) to guarantee consistency across platforms
           * These can occur inside of `<textarea>'s`
           */
          { name: name2, value: val2.replace(rCRLF, "\r\n") }
        ));
      }
      return { name: name2, value: value.replace(rCRLF, "\r\n") };
    }).toArray();
  }
  const Forms = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    serialize,
    serializeArray
  }, Symbol.toStringTag, { value: "Module" }));
  class Cheerio {
    /**
     * Instance of cheerio. Methods are specified in the modules. Usage of this
     * constructor is not recommended. Please use `$.load` instead.
     *
     * @private
     * @param elements - The new selection.
     * @param root - Sets the root node.
     * @param options - Options for the instance.
     */
    constructor(elements, root2, options) {
      this.length = 0;
      this.options = options;
      this._root = root2;
      if (elements) {
        for (let idx = 0; idx < elements.length; idx++) {
          this[idx] = elements[idx];
        }
        this.length = elements.length;
      }
    }
  }
  Cheerio.prototype.cheerio = "[cheerio object]";
  Cheerio.prototype.splice = Array.prototype.splice;
  Cheerio.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  Object.assign(Cheerio.prototype, Attributes, Traversing, Manipulation, Css, Forms);
  function getLoad(parse2, render2) {
    return function load2(content, options, isDocument2 = true) {
      if (content == null) {
        throw new Error("cheerio.load() expects a string");
      }
      const internalOpts = { ...defaultOpts$2, ...flatten(options) };
      const initialRoot = parse2(content, internalOpts, isDocument2, null);
      class LoadedCheerio extends Cheerio {
        _make(selector, context) {
          const cheerio = initialize(selector, context);
          cheerio.prevObject = this;
          return cheerio;
        }
        _parse(content2, options2, isDocument3, context) {
          return parse2(content2, options2, isDocument3, context);
        }
        _render(dom) {
          return render2(dom, this.options);
        }
      }
      function initialize(selector, context, root2 = initialRoot, opts) {
        if (selector && isCheerio(selector))
          return selector;
        const options2 = {
          ...internalOpts,
          ...flatten(opts)
        };
        const r = typeof root2 === "string" ? [parse2(root2, options2, false, null)] : "length" in root2 ? root2 : [root2];
        const rootInstance = isCheerio(r) ? r : new LoadedCheerio(r, null, options2);
        rootInstance._root = rootInstance;
        if (!selector) {
          return new LoadedCheerio(void 0, rootInstance, options2);
        }
        const elements = typeof selector === "string" && isHtml(selector) ? (
          // $(<html>)
          parse2(selector, options2, false, null).children
        ) : isNode(selector) ? (
          // $(dom)
          [selector]
        ) : Array.isArray(selector) ? (
          // $([dom])
          selector
        ) : void 0;
        const instance = new LoadedCheerio(elements, rootInstance, options2);
        if (elements) {
          return instance;
        }
        if (typeof selector !== "string") {
          throw new Error("Unexpected type of selector");
        }
        let search = selector;
        const searchContext = !context ? (
          // If we don't have a context, maybe we have a root, from loading
          rootInstance
        ) : typeof context === "string" ? isHtml(context) ? (
          // $('li', '<ul>...</ul>')
          new LoadedCheerio([parse2(context, options2, false, null)], rootInstance, options2)
        ) : (
          // $('li', 'ul')
          (search = `${context} ${search}`, rootInstance)
        ) : isCheerio(context) ? (
          // $('li', $)
          context
        ) : (
          // $('li', node), $('li', [nodes])
          new LoadedCheerio(Array.isArray(context) ? context : [context], rootInstance, options2)
        );
        if (!searchContext)
          return instance;
        return searchContext.find(search);
      }
      Object.assign(initialize, staticMethods, {
        load: load2,
        // `_root` and `_options` are used in static methods.
        _root: initialRoot,
        _options: internalOpts,
        // Add `fn` for plugins
        fn: LoadedCheerio.prototype,
        // Add the prototype here to maintain `instanceof` behavior.
        prototype: LoadedCheerio.prototype
      });
      return initialize;
    };
  }
  function isNode(obj) {
    return !!obj.name || obj.type === "root" || obj.type === "text" || obj.type === "comment";
  }
  const UNDEFINED_CODE_POINTS = /* @__PURE__ */ new Set([
    65534,
    65535,
    131070,
    131071,
    196606,
    196607,
    262142,
    262143,
    327678,
    327679,
    393214,
    393215,
    458750,
    458751,
    524286,
    524287,
    589822,
    589823,
    655358,
    655359,
    720894,
    720895,
    786430,
    786431,
    851966,
    851967,
    917502,
    917503,
    983038,
    983039,
    1048574,
    1048575,
    1114110,
    1114111
  ]);
  const REPLACEMENT_CHARACTER = "�";
  var CODE_POINTS;
  (function(CODE_POINTS2) {
    CODE_POINTS2[CODE_POINTS2["EOF"] = -1] = "EOF";
    CODE_POINTS2[CODE_POINTS2["NULL"] = 0] = "NULL";
    CODE_POINTS2[CODE_POINTS2["TABULATION"] = 9] = "TABULATION";
    CODE_POINTS2[CODE_POINTS2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
    CODE_POINTS2[CODE_POINTS2["LINE_FEED"] = 10] = "LINE_FEED";
    CODE_POINTS2[CODE_POINTS2["FORM_FEED"] = 12] = "FORM_FEED";
    CODE_POINTS2[CODE_POINTS2["SPACE"] = 32] = "SPACE";
    CODE_POINTS2[CODE_POINTS2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
    CODE_POINTS2[CODE_POINTS2["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
    CODE_POINTS2[CODE_POINTS2["NUMBER_SIGN"] = 35] = "NUMBER_SIGN";
    CODE_POINTS2[CODE_POINTS2["AMPERSAND"] = 38] = "AMPERSAND";
    CODE_POINTS2[CODE_POINTS2["APOSTROPHE"] = 39] = "APOSTROPHE";
    CODE_POINTS2[CODE_POINTS2["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
    CODE_POINTS2[CODE_POINTS2["SOLIDUS"] = 47] = "SOLIDUS";
    CODE_POINTS2[CODE_POINTS2["DIGIT_0"] = 48] = "DIGIT_0";
    CODE_POINTS2[CODE_POINTS2["DIGIT_9"] = 57] = "DIGIT_9";
    CODE_POINTS2[CODE_POINTS2["SEMICOLON"] = 59] = "SEMICOLON";
    CODE_POINTS2[CODE_POINTS2["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
    CODE_POINTS2[CODE_POINTS2["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
    CODE_POINTS2[CODE_POINTS2["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
    CODE_POINTS2[CODE_POINTS2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_A"] = 65] = "LATIN_CAPITAL_A";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_F"] = 70] = "LATIN_CAPITAL_F";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_X"] = 88] = "LATIN_CAPITAL_X";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_Z"] = 90] = "LATIN_CAPITAL_Z";
    CODE_POINTS2[CODE_POINTS2["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
    CODE_POINTS2[CODE_POINTS2["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_A"] = 97] = "LATIN_SMALL_A";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_F"] = 102] = "LATIN_SMALL_F";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_X"] = 120] = "LATIN_SMALL_X";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_Z"] = 122] = "LATIN_SMALL_Z";
    CODE_POINTS2[CODE_POINTS2["REPLACEMENT_CHARACTER"] = 65533] = "REPLACEMENT_CHARACTER";
  })(CODE_POINTS = CODE_POINTS || (CODE_POINTS = {}));
  const SEQUENCES = {
    DASH_DASH: "--",
    CDATA_START: "[CDATA[",
    DOCTYPE: "doctype",
    SCRIPT: "script",
    PUBLIC: "public",
    SYSTEM: "system"
  };
  function isSurrogate(cp) {
    return cp >= 55296 && cp <= 57343;
  }
  function isSurrogatePair(cp) {
    return cp >= 56320 && cp <= 57343;
  }
  function getSurrogatePairCodePoint(cp1, cp2) {
    return (cp1 - 55296) * 1024 + 9216 + cp2;
  }
  function isControlCodePoint(cp) {
    return cp !== 32 && cp !== 10 && cp !== 13 && cp !== 9 && cp !== 12 && cp >= 1 && cp <= 31 || cp >= 127 && cp <= 159;
  }
  function isUndefinedCodePoint(cp) {
    return cp >= 64976 && cp <= 65007 || UNDEFINED_CODE_POINTS.has(cp);
  }
  var ERR;
  (function(ERR2) {
    ERR2["controlCharacterInInputStream"] = "control-character-in-input-stream";
    ERR2["noncharacterInInputStream"] = "noncharacter-in-input-stream";
    ERR2["surrogateInInputStream"] = "surrogate-in-input-stream";
    ERR2["nonVoidHtmlElementStartTagWithTrailingSolidus"] = "non-void-html-element-start-tag-with-trailing-solidus";
    ERR2["endTagWithAttributes"] = "end-tag-with-attributes";
    ERR2["endTagWithTrailingSolidus"] = "end-tag-with-trailing-solidus";
    ERR2["unexpectedSolidusInTag"] = "unexpected-solidus-in-tag";
    ERR2["unexpectedNullCharacter"] = "unexpected-null-character";
    ERR2["unexpectedQuestionMarkInsteadOfTagName"] = "unexpected-question-mark-instead-of-tag-name";
    ERR2["invalidFirstCharacterOfTagName"] = "invalid-first-character-of-tag-name";
    ERR2["unexpectedEqualsSignBeforeAttributeName"] = "unexpected-equals-sign-before-attribute-name";
    ERR2["missingEndTagName"] = "missing-end-tag-name";
    ERR2["unexpectedCharacterInAttributeName"] = "unexpected-character-in-attribute-name";
    ERR2["unknownNamedCharacterReference"] = "unknown-named-character-reference";
    ERR2["missingSemicolonAfterCharacterReference"] = "missing-semicolon-after-character-reference";
    ERR2["unexpectedCharacterAfterDoctypeSystemIdentifier"] = "unexpected-character-after-doctype-system-identifier";
    ERR2["unexpectedCharacterInUnquotedAttributeValue"] = "unexpected-character-in-unquoted-attribute-value";
    ERR2["eofBeforeTagName"] = "eof-before-tag-name";
    ERR2["eofInTag"] = "eof-in-tag";
    ERR2["missingAttributeValue"] = "missing-attribute-value";
    ERR2["missingWhitespaceBetweenAttributes"] = "missing-whitespace-between-attributes";
    ERR2["missingWhitespaceAfterDoctypePublicKeyword"] = "missing-whitespace-after-doctype-public-keyword";
    ERR2["missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers"] = "missing-whitespace-between-doctype-public-and-system-identifiers";
    ERR2["missingWhitespaceAfterDoctypeSystemKeyword"] = "missing-whitespace-after-doctype-system-keyword";
    ERR2["missingQuoteBeforeDoctypePublicIdentifier"] = "missing-quote-before-doctype-public-identifier";
    ERR2["missingQuoteBeforeDoctypeSystemIdentifier"] = "missing-quote-before-doctype-system-identifier";
    ERR2["missingDoctypePublicIdentifier"] = "missing-doctype-public-identifier";
    ERR2["missingDoctypeSystemIdentifier"] = "missing-doctype-system-identifier";
    ERR2["abruptDoctypePublicIdentifier"] = "abrupt-doctype-public-identifier";
    ERR2["abruptDoctypeSystemIdentifier"] = "abrupt-doctype-system-identifier";
    ERR2["cdataInHtmlContent"] = "cdata-in-html-content";
    ERR2["incorrectlyOpenedComment"] = "incorrectly-opened-comment";
    ERR2["eofInScriptHtmlCommentLikeText"] = "eof-in-script-html-comment-like-text";
    ERR2["eofInDoctype"] = "eof-in-doctype";
    ERR2["nestedComment"] = "nested-comment";
    ERR2["abruptClosingOfEmptyComment"] = "abrupt-closing-of-empty-comment";
    ERR2["eofInComment"] = "eof-in-comment";
    ERR2["incorrectlyClosedComment"] = "incorrectly-closed-comment";
    ERR2["eofInCdata"] = "eof-in-cdata";
    ERR2["absenceOfDigitsInNumericCharacterReference"] = "absence-of-digits-in-numeric-character-reference";
    ERR2["nullCharacterReference"] = "null-character-reference";
    ERR2["surrogateCharacterReference"] = "surrogate-character-reference";
    ERR2["characterReferenceOutsideUnicodeRange"] = "character-reference-outside-unicode-range";
    ERR2["controlCharacterReference"] = "control-character-reference";
    ERR2["noncharacterCharacterReference"] = "noncharacter-character-reference";
    ERR2["missingWhitespaceBeforeDoctypeName"] = "missing-whitespace-before-doctype-name";
    ERR2["missingDoctypeName"] = "missing-doctype-name";
    ERR2["invalidCharacterSequenceAfterDoctypeName"] = "invalid-character-sequence-after-doctype-name";
    ERR2["duplicateAttribute"] = "duplicate-attribute";
    ERR2["nonConformingDoctype"] = "non-conforming-doctype";
    ERR2["missingDoctype"] = "missing-doctype";
    ERR2["misplacedDoctype"] = "misplaced-doctype";
    ERR2["endTagWithoutMatchingOpenElement"] = "end-tag-without-matching-open-element";
    ERR2["closingOfElementWithOpenChildElements"] = "closing-of-element-with-open-child-elements";
    ERR2["disallowedContentInNoscriptInHead"] = "disallowed-content-in-noscript-in-head";
    ERR2["openElementsLeftAfterEof"] = "open-elements-left-after-eof";
    ERR2["abandonedHeadElementChild"] = "abandoned-head-element-child";
    ERR2["misplacedStartTagForHeadElement"] = "misplaced-start-tag-for-head-element";
    ERR2["nestedNoscriptInHead"] = "nested-noscript-in-head";
    ERR2["eofInElementThatCanContainOnlyText"] = "eof-in-element-that-can-contain-only-text";
  })(ERR = ERR || (ERR = {}));
  const DEFAULT_BUFFER_WATERLINE = 1 << 16;
  class Preprocessor {
    constructor(handler) {
      this.handler = handler;
      this.html = "";
      this.pos = -1;
      this.lastGapPos = -2;
      this.gapStack = [];
      this.skipNextNewLine = false;
      this.lastChunkWritten = false;
      this.endOfChunkHit = false;
      this.bufferWaterline = DEFAULT_BUFFER_WATERLINE;
      this.isEol = false;
      this.lineStartPos = 0;
      this.droppedBufferSize = 0;
      this.line = 1;
      this.lastErrOffset = -1;
    }
    /** The column on the current line. If we just saw a gap (eg. a surrogate pair), return the index before. */
    get col() {
      return this.pos - this.lineStartPos + Number(this.lastGapPos !== this.pos);
    }
    get offset() {
      return this.droppedBufferSize + this.pos;
    }
    getError(code2) {
      const { line, col, offset } = this;
      return {
        code: code2,
        startLine: line,
        endLine: line,
        startCol: col,
        endCol: col,
        startOffset: offset,
        endOffset: offset
      };
    }
    _err(code2) {
      if (this.handler.onParseError && this.lastErrOffset !== this.offset) {
        this.lastErrOffset = this.offset;
        this.handler.onParseError(this.getError(code2));
      }
    }
    _addGap() {
      this.gapStack.push(this.lastGapPos);
      this.lastGapPos = this.pos;
    }
    _processSurrogate(cp) {
      if (this.pos !== this.html.length - 1) {
        const nextCp = this.html.charCodeAt(this.pos + 1);
        if (isSurrogatePair(nextCp)) {
          this.pos++;
          this._addGap();
          return getSurrogatePairCodePoint(cp, nextCp);
        }
      } else if (!this.lastChunkWritten) {
        this.endOfChunkHit = true;
        return CODE_POINTS.EOF;
      }
      this._err(ERR.surrogateInInputStream);
      return cp;
    }
    willDropParsedChunk() {
      return this.pos > this.bufferWaterline;
    }
    dropParsedChunk() {
      if (this.willDropParsedChunk()) {
        this.html = this.html.substring(this.pos);
        this.lineStartPos -= this.pos;
        this.droppedBufferSize += this.pos;
        this.pos = 0;
        this.lastGapPos = -2;
        this.gapStack.length = 0;
      }
    }
    write(chunk, isLastChunk) {
      if (this.html.length > 0) {
        this.html += chunk;
      } else {
        this.html = chunk;
      }
      this.endOfChunkHit = false;
      this.lastChunkWritten = isLastChunk;
    }
    insertHtmlAtCurrentPos(chunk) {
      this.html = this.html.substring(0, this.pos + 1) + chunk + this.html.substring(this.pos + 1);
      this.endOfChunkHit = false;
    }
    startsWith(pattern, caseSensitive) {
      if (this.pos + pattern.length > this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return false;
      }
      if (caseSensitive) {
        return this.html.startsWith(pattern, this.pos);
      }
      for (let i2 = 0; i2 < pattern.length; i2++) {
        const cp = this.html.charCodeAt(this.pos + i2) | 32;
        if (cp !== pattern.charCodeAt(i2)) {
          return false;
        }
      }
      return true;
    }
    peek(offset) {
      const pos = this.pos + offset;
      if (pos >= this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return CODE_POINTS.EOF;
      }
      const code2 = this.html.charCodeAt(pos);
      return code2 === CODE_POINTS.CARRIAGE_RETURN ? CODE_POINTS.LINE_FEED : code2;
    }
    advance() {
      this.pos++;
      if (this.isEol) {
        this.isEol = false;
        this.line++;
        this.lineStartPos = this.pos;
      }
      if (this.pos >= this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return CODE_POINTS.EOF;
      }
      let cp = this.html.charCodeAt(this.pos);
      if (cp === CODE_POINTS.CARRIAGE_RETURN) {
        this.isEol = true;
        this.skipNextNewLine = true;
        return CODE_POINTS.LINE_FEED;
      }
      if (cp === CODE_POINTS.LINE_FEED) {
        this.isEol = true;
        if (this.skipNextNewLine) {
          this.line--;
          this.skipNextNewLine = false;
          this._addGap();
          return this.advance();
        }
      }
      this.skipNextNewLine = false;
      if (isSurrogate(cp)) {
        cp = this._processSurrogate(cp);
      }
      const isCommonValidRange = this.handler.onParseError === null || cp > 31 && cp < 127 || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.CARRIAGE_RETURN || cp > 159 && cp < 64976;
      if (!isCommonValidRange) {
        this._checkForProblematicCharacters(cp);
      }
      return cp;
    }
    _checkForProblematicCharacters(cp) {
      if (isControlCodePoint(cp)) {
        this._err(ERR.controlCharacterInInputStream);
      } else if (isUndefinedCodePoint(cp)) {
        this._err(ERR.noncharacterInInputStream);
      }
    }
    retreat(count) {
      this.pos -= count;
      while (this.pos < this.lastGapPos) {
        this.lastGapPos = this.gapStack.pop();
        this.pos--;
      }
      this.isEol = false;
    }
  }
  var TokenType;
  (function(TokenType2) {
    TokenType2[TokenType2["CHARACTER"] = 0] = "CHARACTER";
    TokenType2[TokenType2["NULL_CHARACTER"] = 1] = "NULL_CHARACTER";
    TokenType2[TokenType2["WHITESPACE_CHARACTER"] = 2] = "WHITESPACE_CHARACTER";
    TokenType2[TokenType2["START_TAG"] = 3] = "START_TAG";
    TokenType2[TokenType2["END_TAG"] = 4] = "END_TAG";
    TokenType2[TokenType2["COMMENT"] = 5] = "COMMENT";
    TokenType2[TokenType2["DOCTYPE"] = 6] = "DOCTYPE";
    TokenType2[TokenType2["EOF"] = 7] = "EOF";
    TokenType2[TokenType2["HIBERNATION"] = 8] = "HIBERNATION";
  })(TokenType = TokenType || (TokenType = {}));
  function getTokenAttr(token, attrName) {
    for (let i2 = token.attrs.length - 1; i2 >= 0; i2--) {
      if (token.attrs[i2].name === attrName) {
        return token.attrs[i2].value;
      }
    }
    return null;
  }
  var NS;
  (function(NS2) {
    NS2["HTML"] = "http://www.w3.org/1999/xhtml";
    NS2["MATHML"] = "http://www.w3.org/1998/Math/MathML";
    NS2["SVG"] = "http://www.w3.org/2000/svg";
    NS2["XLINK"] = "http://www.w3.org/1999/xlink";
    NS2["XML"] = "http://www.w3.org/XML/1998/namespace";
    NS2["XMLNS"] = "http://www.w3.org/2000/xmlns/";
  })(NS = NS || (NS = {}));
  var ATTRS;
  (function(ATTRS2) {
    ATTRS2["TYPE"] = "type";
    ATTRS2["ACTION"] = "action";
    ATTRS2["ENCODING"] = "encoding";
    ATTRS2["PROMPT"] = "prompt";
    ATTRS2["NAME"] = "name";
    ATTRS2["COLOR"] = "color";
    ATTRS2["FACE"] = "face";
    ATTRS2["SIZE"] = "size";
  })(ATTRS = ATTRS || (ATTRS = {}));
  var DOCUMENT_MODE;
  (function(DOCUMENT_MODE2) {
    DOCUMENT_MODE2["NO_QUIRKS"] = "no-quirks";
    DOCUMENT_MODE2["QUIRKS"] = "quirks";
    DOCUMENT_MODE2["LIMITED_QUIRKS"] = "limited-quirks";
  })(DOCUMENT_MODE = DOCUMENT_MODE || (DOCUMENT_MODE = {}));
  var TAG_NAMES;
  (function(TAG_NAMES2) {
    TAG_NAMES2["A"] = "a";
    TAG_NAMES2["ADDRESS"] = "address";
    TAG_NAMES2["ANNOTATION_XML"] = "annotation-xml";
    TAG_NAMES2["APPLET"] = "applet";
    TAG_NAMES2["AREA"] = "area";
    TAG_NAMES2["ARTICLE"] = "article";
    TAG_NAMES2["ASIDE"] = "aside";
    TAG_NAMES2["B"] = "b";
    TAG_NAMES2["BASE"] = "base";
    TAG_NAMES2["BASEFONT"] = "basefont";
    TAG_NAMES2["BGSOUND"] = "bgsound";
    TAG_NAMES2["BIG"] = "big";
    TAG_NAMES2["BLOCKQUOTE"] = "blockquote";
    TAG_NAMES2["BODY"] = "body";
    TAG_NAMES2["BR"] = "br";
    TAG_NAMES2["BUTTON"] = "button";
    TAG_NAMES2["CAPTION"] = "caption";
    TAG_NAMES2["CENTER"] = "center";
    TAG_NAMES2["CODE"] = "code";
    TAG_NAMES2["COL"] = "col";
    TAG_NAMES2["COLGROUP"] = "colgroup";
    TAG_NAMES2["DD"] = "dd";
    TAG_NAMES2["DESC"] = "desc";
    TAG_NAMES2["DETAILS"] = "details";
    TAG_NAMES2["DIALOG"] = "dialog";
    TAG_NAMES2["DIR"] = "dir";
    TAG_NAMES2["DIV"] = "div";
    TAG_NAMES2["DL"] = "dl";
    TAG_NAMES2["DT"] = "dt";
    TAG_NAMES2["EM"] = "em";
    TAG_NAMES2["EMBED"] = "embed";
    TAG_NAMES2["FIELDSET"] = "fieldset";
    TAG_NAMES2["FIGCAPTION"] = "figcaption";
    TAG_NAMES2["FIGURE"] = "figure";
    TAG_NAMES2["FONT"] = "font";
    TAG_NAMES2["FOOTER"] = "footer";
    TAG_NAMES2["FOREIGN_OBJECT"] = "foreignObject";
    TAG_NAMES2["FORM"] = "form";
    TAG_NAMES2["FRAME"] = "frame";
    TAG_NAMES2["FRAMESET"] = "frameset";
    TAG_NAMES2["H1"] = "h1";
    TAG_NAMES2["H2"] = "h2";
    TAG_NAMES2["H3"] = "h3";
    TAG_NAMES2["H4"] = "h4";
    TAG_NAMES2["H5"] = "h5";
    TAG_NAMES2["H6"] = "h6";
    TAG_NAMES2["HEAD"] = "head";
    TAG_NAMES2["HEADER"] = "header";
    TAG_NAMES2["HGROUP"] = "hgroup";
    TAG_NAMES2["HR"] = "hr";
    TAG_NAMES2["HTML"] = "html";
    TAG_NAMES2["I"] = "i";
    TAG_NAMES2["IMG"] = "img";
    TAG_NAMES2["IMAGE"] = "image";
    TAG_NAMES2["INPUT"] = "input";
    TAG_NAMES2["IFRAME"] = "iframe";
    TAG_NAMES2["KEYGEN"] = "keygen";
    TAG_NAMES2["LABEL"] = "label";
    TAG_NAMES2["LI"] = "li";
    TAG_NAMES2["LINK"] = "link";
    TAG_NAMES2["LISTING"] = "listing";
    TAG_NAMES2["MAIN"] = "main";
    TAG_NAMES2["MALIGNMARK"] = "malignmark";
    TAG_NAMES2["MARQUEE"] = "marquee";
    TAG_NAMES2["MATH"] = "math";
    TAG_NAMES2["MENU"] = "menu";
    TAG_NAMES2["META"] = "meta";
    TAG_NAMES2["MGLYPH"] = "mglyph";
    TAG_NAMES2["MI"] = "mi";
    TAG_NAMES2["MO"] = "mo";
    TAG_NAMES2["MN"] = "mn";
    TAG_NAMES2["MS"] = "ms";
    TAG_NAMES2["MTEXT"] = "mtext";
    TAG_NAMES2["NAV"] = "nav";
    TAG_NAMES2["NOBR"] = "nobr";
    TAG_NAMES2["NOFRAMES"] = "noframes";
    TAG_NAMES2["NOEMBED"] = "noembed";
    TAG_NAMES2["NOSCRIPT"] = "noscript";
    TAG_NAMES2["OBJECT"] = "object";
    TAG_NAMES2["OL"] = "ol";
    TAG_NAMES2["OPTGROUP"] = "optgroup";
    TAG_NAMES2["OPTION"] = "option";
    TAG_NAMES2["P"] = "p";
    TAG_NAMES2["PARAM"] = "param";
    TAG_NAMES2["PLAINTEXT"] = "plaintext";
    TAG_NAMES2["PRE"] = "pre";
    TAG_NAMES2["RB"] = "rb";
    TAG_NAMES2["RP"] = "rp";
    TAG_NAMES2["RT"] = "rt";
    TAG_NAMES2["RTC"] = "rtc";
    TAG_NAMES2["RUBY"] = "ruby";
    TAG_NAMES2["S"] = "s";
    TAG_NAMES2["SCRIPT"] = "script";
    TAG_NAMES2["SECTION"] = "section";
    TAG_NAMES2["SELECT"] = "select";
    TAG_NAMES2["SOURCE"] = "source";
    TAG_NAMES2["SMALL"] = "small";
    TAG_NAMES2["SPAN"] = "span";
    TAG_NAMES2["STRIKE"] = "strike";
    TAG_NAMES2["STRONG"] = "strong";
    TAG_NAMES2["STYLE"] = "style";
    TAG_NAMES2["SUB"] = "sub";
    TAG_NAMES2["SUMMARY"] = "summary";
    TAG_NAMES2["SUP"] = "sup";
    TAG_NAMES2["TABLE"] = "table";
    TAG_NAMES2["TBODY"] = "tbody";
    TAG_NAMES2["TEMPLATE"] = "template";
    TAG_NAMES2["TEXTAREA"] = "textarea";
    TAG_NAMES2["TFOOT"] = "tfoot";
    TAG_NAMES2["TD"] = "td";
    TAG_NAMES2["TH"] = "th";
    TAG_NAMES2["THEAD"] = "thead";
    TAG_NAMES2["TITLE"] = "title";
    TAG_NAMES2["TR"] = "tr";
    TAG_NAMES2["TRACK"] = "track";
    TAG_NAMES2["TT"] = "tt";
    TAG_NAMES2["U"] = "u";
    TAG_NAMES2["UL"] = "ul";
    TAG_NAMES2["SVG"] = "svg";
    TAG_NAMES2["VAR"] = "var";
    TAG_NAMES2["WBR"] = "wbr";
    TAG_NAMES2["XMP"] = "xmp";
  })(TAG_NAMES = TAG_NAMES || (TAG_NAMES = {}));
  var TAG_ID;
  (function(TAG_ID2) {
    TAG_ID2[TAG_ID2["UNKNOWN"] = 0] = "UNKNOWN";
    TAG_ID2[TAG_ID2["A"] = 1] = "A";
    TAG_ID2[TAG_ID2["ADDRESS"] = 2] = "ADDRESS";
    TAG_ID2[TAG_ID2["ANNOTATION_XML"] = 3] = "ANNOTATION_XML";
    TAG_ID2[TAG_ID2["APPLET"] = 4] = "APPLET";
    TAG_ID2[TAG_ID2["AREA"] = 5] = "AREA";
    TAG_ID2[TAG_ID2["ARTICLE"] = 6] = "ARTICLE";
    TAG_ID2[TAG_ID2["ASIDE"] = 7] = "ASIDE";
    TAG_ID2[TAG_ID2["B"] = 8] = "B";
    TAG_ID2[TAG_ID2["BASE"] = 9] = "BASE";
    TAG_ID2[TAG_ID2["BASEFONT"] = 10] = "BASEFONT";
    TAG_ID2[TAG_ID2["BGSOUND"] = 11] = "BGSOUND";
    TAG_ID2[TAG_ID2["BIG"] = 12] = "BIG";
    TAG_ID2[TAG_ID2["BLOCKQUOTE"] = 13] = "BLOCKQUOTE";
    TAG_ID2[TAG_ID2["BODY"] = 14] = "BODY";
    TAG_ID2[TAG_ID2["BR"] = 15] = "BR";
    TAG_ID2[TAG_ID2["BUTTON"] = 16] = "BUTTON";
    TAG_ID2[TAG_ID2["CAPTION"] = 17] = "CAPTION";
    TAG_ID2[TAG_ID2["CENTER"] = 18] = "CENTER";
    TAG_ID2[TAG_ID2["CODE"] = 19] = "CODE";
    TAG_ID2[TAG_ID2["COL"] = 20] = "COL";
    TAG_ID2[TAG_ID2["COLGROUP"] = 21] = "COLGROUP";
    TAG_ID2[TAG_ID2["DD"] = 22] = "DD";
    TAG_ID2[TAG_ID2["DESC"] = 23] = "DESC";
    TAG_ID2[TAG_ID2["DETAILS"] = 24] = "DETAILS";
    TAG_ID2[TAG_ID2["DIALOG"] = 25] = "DIALOG";
    TAG_ID2[TAG_ID2["DIR"] = 26] = "DIR";
    TAG_ID2[TAG_ID2["DIV"] = 27] = "DIV";
    TAG_ID2[TAG_ID2["DL"] = 28] = "DL";
    TAG_ID2[TAG_ID2["DT"] = 29] = "DT";
    TAG_ID2[TAG_ID2["EM"] = 30] = "EM";
    TAG_ID2[TAG_ID2["EMBED"] = 31] = "EMBED";
    TAG_ID2[TAG_ID2["FIELDSET"] = 32] = "FIELDSET";
    TAG_ID2[TAG_ID2["FIGCAPTION"] = 33] = "FIGCAPTION";
    TAG_ID2[TAG_ID2["FIGURE"] = 34] = "FIGURE";
    TAG_ID2[TAG_ID2["FONT"] = 35] = "FONT";
    TAG_ID2[TAG_ID2["FOOTER"] = 36] = "FOOTER";
    TAG_ID2[TAG_ID2["FOREIGN_OBJECT"] = 37] = "FOREIGN_OBJECT";
    TAG_ID2[TAG_ID2["FORM"] = 38] = "FORM";
    TAG_ID2[TAG_ID2["FRAME"] = 39] = "FRAME";
    TAG_ID2[TAG_ID2["FRAMESET"] = 40] = "FRAMESET";
    TAG_ID2[TAG_ID2["H1"] = 41] = "H1";
    TAG_ID2[TAG_ID2["H2"] = 42] = "H2";
    TAG_ID2[TAG_ID2["H3"] = 43] = "H3";
    TAG_ID2[TAG_ID2["H4"] = 44] = "H4";
    TAG_ID2[TAG_ID2["H5"] = 45] = "H5";
    TAG_ID2[TAG_ID2["H6"] = 46] = "H6";
    TAG_ID2[TAG_ID2["HEAD"] = 47] = "HEAD";
    TAG_ID2[TAG_ID2["HEADER"] = 48] = "HEADER";
    TAG_ID2[TAG_ID2["HGROUP"] = 49] = "HGROUP";
    TAG_ID2[TAG_ID2["HR"] = 50] = "HR";
    TAG_ID2[TAG_ID2["HTML"] = 51] = "HTML";
    TAG_ID2[TAG_ID2["I"] = 52] = "I";
    TAG_ID2[TAG_ID2["IMG"] = 53] = "IMG";
    TAG_ID2[TAG_ID2["IMAGE"] = 54] = "IMAGE";
    TAG_ID2[TAG_ID2["INPUT"] = 55] = "INPUT";
    TAG_ID2[TAG_ID2["IFRAME"] = 56] = "IFRAME";
    TAG_ID2[TAG_ID2["KEYGEN"] = 57] = "KEYGEN";
    TAG_ID2[TAG_ID2["LABEL"] = 58] = "LABEL";
    TAG_ID2[TAG_ID2["LI"] = 59] = "LI";
    TAG_ID2[TAG_ID2["LINK"] = 60] = "LINK";
    TAG_ID2[TAG_ID2["LISTING"] = 61] = "LISTING";
    TAG_ID2[TAG_ID2["MAIN"] = 62] = "MAIN";
    TAG_ID2[TAG_ID2["MALIGNMARK"] = 63] = "MALIGNMARK";
    TAG_ID2[TAG_ID2["MARQUEE"] = 64] = "MARQUEE";
    TAG_ID2[TAG_ID2["MATH"] = 65] = "MATH";
    TAG_ID2[TAG_ID2["MENU"] = 66] = "MENU";
    TAG_ID2[TAG_ID2["META"] = 67] = "META";
    TAG_ID2[TAG_ID2["MGLYPH"] = 68] = "MGLYPH";
    TAG_ID2[TAG_ID2["MI"] = 69] = "MI";
    TAG_ID2[TAG_ID2["MO"] = 70] = "MO";
    TAG_ID2[TAG_ID2["MN"] = 71] = "MN";
    TAG_ID2[TAG_ID2["MS"] = 72] = "MS";
    TAG_ID2[TAG_ID2["MTEXT"] = 73] = "MTEXT";
    TAG_ID2[TAG_ID2["NAV"] = 74] = "NAV";
    TAG_ID2[TAG_ID2["NOBR"] = 75] = "NOBR";
    TAG_ID2[TAG_ID2["NOFRAMES"] = 76] = "NOFRAMES";
    TAG_ID2[TAG_ID2["NOEMBED"] = 77] = "NOEMBED";
    TAG_ID2[TAG_ID2["NOSCRIPT"] = 78] = "NOSCRIPT";
    TAG_ID2[TAG_ID2["OBJECT"] = 79] = "OBJECT";
    TAG_ID2[TAG_ID2["OL"] = 80] = "OL";
    TAG_ID2[TAG_ID2["OPTGROUP"] = 81] = "OPTGROUP";
    TAG_ID2[TAG_ID2["OPTION"] = 82] = "OPTION";
    TAG_ID2[TAG_ID2["P"] = 83] = "P";
    TAG_ID2[TAG_ID2["PARAM"] = 84] = "PARAM";
    TAG_ID2[TAG_ID2["PLAINTEXT"] = 85] = "PLAINTEXT";
    TAG_ID2[TAG_ID2["PRE"] = 86] = "PRE";
    TAG_ID2[TAG_ID2["RB"] = 87] = "RB";
    TAG_ID2[TAG_ID2["RP"] = 88] = "RP";
    TAG_ID2[TAG_ID2["RT"] = 89] = "RT";
    TAG_ID2[TAG_ID2["RTC"] = 90] = "RTC";
    TAG_ID2[TAG_ID2["RUBY"] = 91] = "RUBY";
    TAG_ID2[TAG_ID2["S"] = 92] = "S";
    TAG_ID2[TAG_ID2["SCRIPT"] = 93] = "SCRIPT";
    TAG_ID2[TAG_ID2["SECTION"] = 94] = "SECTION";
    TAG_ID2[TAG_ID2["SELECT"] = 95] = "SELECT";
    TAG_ID2[TAG_ID2["SOURCE"] = 96] = "SOURCE";
    TAG_ID2[TAG_ID2["SMALL"] = 97] = "SMALL";
    TAG_ID2[TAG_ID2["SPAN"] = 98] = "SPAN";
    TAG_ID2[TAG_ID2["STRIKE"] = 99] = "STRIKE";
    TAG_ID2[TAG_ID2["STRONG"] = 100] = "STRONG";
    TAG_ID2[TAG_ID2["STYLE"] = 101] = "STYLE";
    TAG_ID2[TAG_ID2["SUB"] = 102] = "SUB";
    TAG_ID2[TAG_ID2["SUMMARY"] = 103] = "SUMMARY";
    TAG_ID2[TAG_ID2["SUP"] = 104] = "SUP";
    TAG_ID2[TAG_ID2["TABLE"] = 105] = "TABLE";
    TAG_ID2[TAG_ID2["TBODY"] = 106] = "TBODY";
    TAG_ID2[TAG_ID2["TEMPLATE"] = 107] = "TEMPLATE";
    TAG_ID2[TAG_ID2["TEXTAREA"] = 108] = "TEXTAREA";
    TAG_ID2[TAG_ID2["TFOOT"] = 109] = "TFOOT";
    TAG_ID2[TAG_ID2["TD"] = 110] = "TD";
    TAG_ID2[TAG_ID2["TH"] = 111] = "TH";
    TAG_ID2[TAG_ID2["THEAD"] = 112] = "THEAD";
    TAG_ID2[TAG_ID2["TITLE"] = 113] = "TITLE";
    TAG_ID2[TAG_ID2["TR"] = 114] = "TR";
    TAG_ID2[TAG_ID2["TRACK"] = 115] = "TRACK";
    TAG_ID2[TAG_ID2["TT"] = 116] = "TT";
    TAG_ID2[TAG_ID2["U"] = 117] = "U";
    TAG_ID2[TAG_ID2["UL"] = 118] = "UL";
    TAG_ID2[TAG_ID2["SVG"] = 119] = "SVG";
    TAG_ID2[TAG_ID2["VAR"] = 120] = "VAR";
    TAG_ID2[TAG_ID2["WBR"] = 121] = "WBR";
    TAG_ID2[TAG_ID2["XMP"] = 122] = "XMP";
  })(TAG_ID = TAG_ID || (TAG_ID = {}));
  const TAG_NAME_TO_ID = /* @__PURE__ */ new Map([
    [TAG_NAMES.A, TAG_ID.A],
    [TAG_NAMES.ADDRESS, TAG_ID.ADDRESS],
    [TAG_NAMES.ANNOTATION_XML, TAG_ID.ANNOTATION_XML],
    [TAG_NAMES.APPLET, TAG_ID.APPLET],
    [TAG_NAMES.AREA, TAG_ID.AREA],
    [TAG_NAMES.ARTICLE, TAG_ID.ARTICLE],
    [TAG_NAMES.ASIDE, TAG_ID.ASIDE],
    [TAG_NAMES.B, TAG_ID.B],
    [TAG_NAMES.BASE, TAG_ID.BASE],
    [TAG_NAMES.BASEFONT, TAG_ID.BASEFONT],
    [TAG_NAMES.BGSOUND, TAG_ID.BGSOUND],
    [TAG_NAMES.BIG, TAG_ID.BIG],
    [TAG_NAMES.BLOCKQUOTE, TAG_ID.BLOCKQUOTE],
    [TAG_NAMES.BODY, TAG_ID.BODY],
    [TAG_NAMES.BR, TAG_ID.BR],
    [TAG_NAMES.BUTTON, TAG_ID.BUTTON],
    [TAG_NAMES.CAPTION, TAG_ID.CAPTION],
    [TAG_NAMES.CENTER, TAG_ID.CENTER],
    [TAG_NAMES.CODE, TAG_ID.CODE],
    [TAG_NAMES.COL, TAG_ID.COL],
    [TAG_NAMES.COLGROUP, TAG_ID.COLGROUP],
    [TAG_NAMES.DD, TAG_ID.DD],
    [TAG_NAMES.DESC, TAG_ID.DESC],
    [TAG_NAMES.DETAILS, TAG_ID.DETAILS],
    [TAG_NAMES.DIALOG, TAG_ID.DIALOG],
    [TAG_NAMES.DIR, TAG_ID.DIR],
    [TAG_NAMES.DIV, TAG_ID.DIV],
    [TAG_NAMES.DL, TAG_ID.DL],
    [TAG_NAMES.DT, TAG_ID.DT],
    [TAG_NAMES.EM, TAG_ID.EM],
    [TAG_NAMES.EMBED, TAG_ID.EMBED],
    [TAG_NAMES.FIELDSET, TAG_ID.FIELDSET],
    [TAG_NAMES.FIGCAPTION, TAG_ID.FIGCAPTION],
    [TAG_NAMES.FIGURE, TAG_ID.FIGURE],
    [TAG_NAMES.FONT, TAG_ID.FONT],
    [TAG_NAMES.FOOTER, TAG_ID.FOOTER],
    [TAG_NAMES.FOREIGN_OBJECT, TAG_ID.FOREIGN_OBJECT],
    [TAG_NAMES.FORM, TAG_ID.FORM],
    [TAG_NAMES.FRAME, TAG_ID.FRAME],
    [TAG_NAMES.FRAMESET, TAG_ID.FRAMESET],
    [TAG_NAMES.H1, TAG_ID.H1],
    [TAG_NAMES.H2, TAG_ID.H2],
    [TAG_NAMES.H3, TAG_ID.H3],
    [TAG_NAMES.H4, TAG_ID.H4],
    [TAG_NAMES.H5, TAG_ID.H5],
    [TAG_NAMES.H6, TAG_ID.H6],
    [TAG_NAMES.HEAD, TAG_ID.HEAD],
    [TAG_NAMES.HEADER, TAG_ID.HEADER],
    [TAG_NAMES.HGROUP, TAG_ID.HGROUP],
    [TAG_NAMES.HR, TAG_ID.HR],
    [TAG_NAMES.HTML, TAG_ID.HTML],
    [TAG_NAMES.I, TAG_ID.I],
    [TAG_NAMES.IMG, TAG_ID.IMG],
    [TAG_NAMES.IMAGE, TAG_ID.IMAGE],
    [TAG_NAMES.INPUT, TAG_ID.INPUT],
    [TAG_NAMES.IFRAME, TAG_ID.IFRAME],
    [TAG_NAMES.KEYGEN, TAG_ID.KEYGEN],
    [TAG_NAMES.LABEL, TAG_ID.LABEL],
    [TAG_NAMES.LI, TAG_ID.LI],
    [TAG_NAMES.LINK, TAG_ID.LINK],
    [TAG_NAMES.LISTING, TAG_ID.LISTING],
    [TAG_NAMES.MAIN, TAG_ID.MAIN],
    [TAG_NAMES.MALIGNMARK, TAG_ID.MALIGNMARK],
    [TAG_NAMES.MARQUEE, TAG_ID.MARQUEE],
    [TAG_NAMES.MATH, TAG_ID.MATH],
    [TAG_NAMES.MENU, TAG_ID.MENU],
    [TAG_NAMES.META, TAG_ID.META],
    [TAG_NAMES.MGLYPH, TAG_ID.MGLYPH],
    [TAG_NAMES.MI, TAG_ID.MI],
    [TAG_NAMES.MO, TAG_ID.MO],
    [TAG_NAMES.MN, TAG_ID.MN],
    [TAG_NAMES.MS, TAG_ID.MS],
    [TAG_NAMES.MTEXT, TAG_ID.MTEXT],
    [TAG_NAMES.NAV, TAG_ID.NAV],
    [TAG_NAMES.NOBR, TAG_ID.NOBR],
    [TAG_NAMES.NOFRAMES, TAG_ID.NOFRAMES],
    [TAG_NAMES.NOEMBED, TAG_ID.NOEMBED],
    [TAG_NAMES.NOSCRIPT, TAG_ID.NOSCRIPT],
    [TAG_NAMES.OBJECT, TAG_ID.OBJECT],
    [TAG_NAMES.OL, TAG_ID.OL],
    [TAG_NAMES.OPTGROUP, TAG_ID.OPTGROUP],
    [TAG_NAMES.OPTION, TAG_ID.OPTION],
    [TAG_NAMES.P, TAG_ID.P],
    [TAG_NAMES.PARAM, TAG_ID.PARAM],
    [TAG_NAMES.PLAINTEXT, TAG_ID.PLAINTEXT],
    [TAG_NAMES.PRE, TAG_ID.PRE],
    [TAG_NAMES.RB, TAG_ID.RB],
    [TAG_NAMES.RP, TAG_ID.RP],
    [TAG_NAMES.RT, TAG_ID.RT],
    [TAG_NAMES.RTC, TAG_ID.RTC],
    [TAG_NAMES.RUBY, TAG_ID.RUBY],
    [TAG_NAMES.S, TAG_ID.S],
    [TAG_NAMES.SCRIPT, TAG_ID.SCRIPT],
    [TAG_NAMES.SECTION, TAG_ID.SECTION],
    [TAG_NAMES.SELECT, TAG_ID.SELECT],
    [TAG_NAMES.SOURCE, TAG_ID.SOURCE],
    [TAG_NAMES.SMALL, TAG_ID.SMALL],
    [TAG_NAMES.SPAN, TAG_ID.SPAN],
    [TAG_NAMES.STRIKE, TAG_ID.STRIKE],
    [TAG_NAMES.STRONG, TAG_ID.STRONG],
    [TAG_NAMES.STYLE, TAG_ID.STYLE],
    [TAG_NAMES.SUB, TAG_ID.SUB],
    [TAG_NAMES.SUMMARY, TAG_ID.SUMMARY],
    [TAG_NAMES.SUP, TAG_ID.SUP],
    [TAG_NAMES.TABLE, TAG_ID.TABLE],
    [TAG_NAMES.TBODY, TAG_ID.TBODY],
    [TAG_NAMES.TEMPLATE, TAG_ID.TEMPLATE],
    [TAG_NAMES.TEXTAREA, TAG_ID.TEXTAREA],
    [TAG_NAMES.TFOOT, TAG_ID.TFOOT],
    [TAG_NAMES.TD, TAG_ID.TD],
    [TAG_NAMES.TH, TAG_ID.TH],
    [TAG_NAMES.THEAD, TAG_ID.THEAD],
    [TAG_NAMES.TITLE, TAG_ID.TITLE],
    [TAG_NAMES.TR, TAG_ID.TR],
    [TAG_NAMES.TRACK, TAG_ID.TRACK],
    [TAG_NAMES.TT, TAG_ID.TT],
    [TAG_NAMES.U, TAG_ID.U],
    [TAG_NAMES.UL, TAG_ID.UL],
    [TAG_NAMES.SVG, TAG_ID.SVG],
    [TAG_NAMES.VAR, TAG_ID.VAR],
    [TAG_NAMES.WBR, TAG_ID.WBR],
    [TAG_NAMES.XMP, TAG_ID.XMP]
  ]);
  function getTagID(tagName) {
    var _a2;
    return (_a2 = TAG_NAME_TO_ID.get(tagName)) !== null && _a2 !== void 0 ? _a2 : TAG_ID.UNKNOWN;
  }
  const $ = TAG_ID;
  const SPECIAL_ELEMENTS = {
    [NS.HTML]: /* @__PURE__ */ new Set([
      $.ADDRESS,
      $.APPLET,
      $.AREA,
      $.ARTICLE,
      $.ASIDE,
      $.BASE,
      $.BASEFONT,
      $.BGSOUND,
      $.BLOCKQUOTE,
      $.BODY,
      $.BR,
      $.BUTTON,
      $.CAPTION,
      $.CENTER,
      $.COL,
      $.COLGROUP,
      $.DD,
      $.DETAILS,
      $.DIR,
      $.DIV,
      $.DL,
      $.DT,
      $.EMBED,
      $.FIELDSET,
      $.FIGCAPTION,
      $.FIGURE,
      $.FOOTER,
      $.FORM,
      $.FRAME,
      $.FRAMESET,
      $.H1,
      $.H2,
      $.H3,
      $.H4,
      $.H5,
      $.H6,
      $.HEAD,
      $.HEADER,
      $.HGROUP,
      $.HR,
      $.HTML,
      $.IFRAME,
      $.IMG,
      $.INPUT,
      $.LI,
      $.LINK,
      $.LISTING,
      $.MAIN,
      $.MARQUEE,
      $.MENU,
      $.META,
      $.NAV,
      $.NOEMBED,
      $.NOFRAMES,
      $.NOSCRIPT,
      $.OBJECT,
      $.OL,
      $.P,
      $.PARAM,
      $.PLAINTEXT,
      $.PRE,
      $.SCRIPT,
      $.SECTION,
      $.SELECT,
      $.SOURCE,
      $.STYLE,
      $.SUMMARY,
      $.TABLE,
      $.TBODY,
      $.TD,
      $.TEMPLATE,
      $.TEXTAREA,
      $.TFOOT,
      $.TH,
      $.THEAD,
      $.TITLE,
      $.TR,
      $.TRACK,
      $.UL,
      $.WBR,
      $.XMP
    ]),
    [NS.MATHML]: /* @__PURE__ */ new Set([$.MI, $.MO, $.MN, $.MS, $.MTEXT, $.ANNOTATION_XML]),
    [NS.SVG]: /* @__PURE__ */ new Set([$.TITLE, $.FOREIGN_OBJECT, $.DESC]),
    [NS.XLINK]: /* @__PURE__ */ new Set(),
    [NS.XML]: /* @__PURE__ */ new Set(),
    [NS.XMLNS]: /* @__PURE__ */ new Set()
  };
  function isNumberedHeader(tn) {
    return tn === $.H1 || tn === $.H2 || tn === $.H3 || tn === $.H4 || tn === $.H5 || tn === $.H6;
  }
  const UNESCAPED_TEXT = /* @__PURE__ */ new Set([
    TAG_NAMES.STYLE,
    TAG_NAMES.SCRIPT,
    TAG_NAMES.XMP,
    TAG_NAMES.IFRAME,
    TAG_NAMES.NOEMBED,
    TAG_NAMES.NOFRAMES,
    TAG_NAMES.PLAINTEXT
  ]);
  function hasUnescapedText(tn, scriptingEnabled) {
    return UNESCAPED_TEXT.has(tn) || scriptingEnabled && tn === TAG_NAMES.NOSCRIPT;
  }
  const C1_CONTROLS_REFERENCE_REPLACEMENTS = /* @__PURE__ */ new Map([
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376]
  ]);
  var State$3;
  (function(State2) {
    State2[State2["DATA"] = 0] = "DATA";
    State2[State2["RCDATA"] = 1] = "RCDATA";
    State2[State2["RAWTEXT"] = 2] = "RAWTEXT";
    State2[State2["SCRIPT_DATA"] = 3] = "SCRIPT_DATA";
    State2[State2["PLAINTEXT"] = 4] = "PLAINTEXT";
    State2[State2["TAG_OPEN"] = 5] = "TAG_OPEN";
    State2[State2["END_TAG_OPEN"] = 6] = "END_TAG_OPEN";
    State2[State2["TAG_NAME"] = 7] = "TAG_NAME";
    State2[State2["RCDATA_LESS_THAN_SIGN"] = 8] = "RCDATA_LESS_THAN_SIGN";
    State2[State2["RCDATA_END_TAG_OPEN"] = 9] = "RCDATA_END_TAG_OPEN";
    State2[State2["RCDATA_END_TAG_NAME"] = 10] = "RCDATA_END_TAG_NAME";
    State2[State2["RAWTEXT_LESS_THAN_SIGN"] = 11] = "RAWTEXT_LESS_THAN_SIGN";
    State2[State2["RAWTEXT_END_TAG_OPEN"] = 12] = "RAWTEXT_END_TAG_OPEN";
    State2[State2["RAWTEXT_END_TAG_NAME"] = 13] = "RAWTEXT_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_LESS_THAN_SIGN"] = 14] = "SCRIPT_DATA_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_END_TAG_OPEN"] = 15] = "SCRIPT_DATA_END_TAG_OPEN";
    State2[State2["SCRIPT_DATA_END_TAG_NAME"] = 16] = "SCRIPT_DATA_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_ESCAPE_START"] = 17] = "SCRIPT_DATA_ESCAPE_START";
    State2[State2["SCRIPT_DATA_ESCAPE_START_DASH"] = 18] = "SCRIPT_DATA_ESCAPE_START_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED"] = 19] = "SCRIPT_DATA_ESCAPED";
    State2[State2["SCRIPT_DATA_ESCAPED_DASH"] = 20] = "SCRIPT_DATA_ESCAPED_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED_DASH_DASH"] = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN"] = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_OPEN"] = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN";
    State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_NAME"] = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_START"] = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED"] = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH"] = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH"] = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN"] = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_END"] = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END";
    State2[State2["BEFORE_ATTRIBUTE_NAME"] = 31] = "BEFORE_ATTRIBUTE_NAME";
    State2[State2["ATTRIBUTE_NAME"] = 32] = "ATTRIBUTE_NAME";
    State2[State2["AFTER_ATTRIBUTE_NAME"] = 33] = "AFTER_ATTRIBUTE_NAME";
    State2[State2["BEFORE_ATTRIBUTE_VALUE"] = 34] = "BEFORE_ATTRIBUTE_VALUE";
    State2[State2["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
    State2[State2["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
    State2[State2["ATTRIBUTE_VALUE_UNQUOTED"] = 37] = "ATTRIBUTE_VALUE_UNQUOTED";
    State2[State2["AFTER_ATTRIBUTE_VALUE_QUOTED"] = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED";
    State2[State2["SELF_CLOSING_START_TAG"] = 39] = "SELF_CLOSING_START_TAG";
    State2[State2["BOGUS_COMMENT"] = 40] = "BOGUS_COMMENT";
    State2[State2["MARKUP_DECLARATION_OPEN"] = 41] = "MARKUP_DECLARATION_OPEN";
    State2[State2["COMMENT_START"] = 42] = "COMMENT_START";
    State2[State2["COMMENT_START_DASH"] = 43] = "COMMENT_START_DASH";
    State2[State2["COMMENT"] = 44] = "COMMENT";
    State2[State2["COMMENT_LESS_THAN_SIGN"] = 45] = "COMMENT_LESS_THAN_SIGN";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG"] = 46] = "COMMENT_LESS_THAN_SIGN_BANG";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH"] = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH"] = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH";
    State2[State2["COMMENT_END_DASH"] = 49] = "COMMENT_END_DASH";
    State2[State2["COMMENT_END"] = 50] = "COMMENT_END";
    State2[State2["COMMENT_END_BANG"] = 51] = "COMMENT_END_BANG";
    State2[State2["DOCTYPE"] = 52] = "DOCTYPE";
    State2[State2["BEFORE_DOCTYPE_NAME"] = 53] = "BEFORE_DOCTYPE_NAME";
    State2[State2["DOCTYPE_NAME"] = 54] = "DOCTYPE_NAME";
    State2[State2["AFTER_DOCTYPE_NAME"] = 55] = "AFTER_DOCTYPE_NAME";
    State2[State2["AFTER_DOCTYPE_PUBLIC_KEYWORD"] = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD";
    State2[State2["BEFORE_DOCTYPE_PUBLIC_IDENTIFIER"] = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER";
    State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED"] = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED";
    State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED"] = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED";
    State2[State2["AFTER_DOCTYPE_PUBLIC_IDENTIFIER"] = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER";
    State2[State2["BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS"] = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS";
    State2[State2["AFTER_DOCTYPE_SYSTEM_KEYWORD"] = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD";
    State2[State2["BEFORE_DOCTYPE_SYSTEM_IDENTIFIER"] = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER";
    State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED"] = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED";
    State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED"] = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED";
    State2[State2["AFTER_DOCTYPE_SYSTEM_IDENTIFIER"] = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER";
    State2[State2["BOGUS_DOCTYPE"] = 67] = "BOGUS_DOCTYPE";
    State2[State2["CDATA_SECTION"] = 68] = "CDATA_SECTION";
    State2[State2["CDATA_SECTION_BRACKET"] = 69] = "CDATA_SECTION_BRACKET";
    State2[State2["CDATA_SECTION_END"] = 70] = "CDATA_SECTION_END";
    State2[State2["CHARACTER_REFERENCE"] = 71] = "CHARACTER_REFERENCE";
    State2[State2["NAMED_CHARACTER_REFERENCE"] = 72] = "NAMED_CHARACTER_REFERENCE";
    State2[State2["AMBIGUOUS_AMPERSAND"] = 73] = "AMBIGUOUS_AMPERSAND";
    State2[State2["NUMERIC_CHARACTER_REFERENCE"] = 74] = "NUMERIC_CHARACTER_REFERENCE";
    State2[State2["HEXADEMICAL_CHARACTER_REFERENCE_START"] = 75] = "HEXADEMICAL_CHARACTER_REFERENCE_START";
    State2[State2["HEXADEMICAL_CHARACTER_REFERENCE"] = 76] = "HEXADEMICAL_CHARACTER_REFERENCE";
    State2[State2["DECIMAL_CHARACTER_REFERENCE"] = 77] = "DECIMAL_CHARACTER_REFERENCE";
    State2[State2["NUMERIC_CHARACTER_REFERENCE_END"] = 78] = "NUMERIC_CHARACTER_REFERENCE_END";
  })(State$3 || (State$3 = {}));
  const TokenizerMode = {
    DATA: State$3.DATA,
    RCDATA: State$3.RCDATA,
    RAWTEXT: State$3.RAWTEXT,
    SCRIPT_DATA: State$3.SCRIPT_DATA,
    PLAINTEXT: State$3.PLAINTEXT,
    CDATA_SECTION: State$3.CDATA_SECTION
  };
  function isAsciiDigit(cp) {
    return cp >= CODE_POINTS.DIGIT_0 && cp <= CODE_POINTS.DIGIT_9;
  }
  function isAsciiUpper(cp) {
    return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_Z;
  }
  function isAsciiLower(cp) {
    return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_Z;
  }
  function isAsciiLetter(cp) {
    return isAsciiLower(cp) || isAsciiUpper(cp);
  }
  function isAsciiAlphaNumeric(cp) {
    return isAsciiLetter(cp) || isAsciiDigit(cp);
  }
  function isAsciiUpperHexDigit(cp) {
    return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_F;
  }
  function isAsciiLowerHexDigit(cp) {
    return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_F;
  }
  function isAsciiHexDigit(cp) {
    return isAsciiDigit(cp) || isAsciiUpperHexDigit(cp) || isAsciiLowerHexDigit(cp);
  }
  function toAsciiLower(cp) {
    return cp + 32;
  }
  function isWhitespace$2(cp) {
    return cp === CODE_POINTS.SPACE || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.TABULATION || cp === CODE_POINTS.FORM_FEED;
  }
  function isEntityInAttributeInvalidEnd(nextCp) {
    return nextCp === CODE_POINTS.EQUALS_SIGN || isAsciiAlphaNumeric(nextCp);
  }
  function isScriptDataDoubleEscapeSequenceEnd(cp) {
    return isWhitespace$2(cp) || cp === CODE_POINTS.SOLIDUS || cp === CODE_POINTS.GREATER_THAN_SIGN;
  }
  let Tokenizer$1 = class Tokenizer {
    constructor(options, handler) {
      this.options = options;
      this.handler = handler;
      this.paused = false;
      this.inLoop = false;
      this.inForeignNode = false;
      this.lastStartTagName = "";
      this.active = false;
      this.state = State$3.DATA;
      this.returnState = State$3.DATA;
      this.charRefCode = -1;
      this.consumedAfterSnapshot = -1;
      this.currentCharacterToken = null;
      this.currentToken = null;
      this.currentAttr = { name: "", value: "" };
      this.preprocessor = new Preprocessor(handler);
      this.currentLocation = this.getCurrentLocation(-1);
    }
    //Errors
    _err(code2) {
      var _a2, _b;
      (_b = (_a2 = this.handler).onParseError) === null || _b === void 0 ? void 0 : _b.call(_a2, this.preprocessor.getError(code2));
    }
    // NOTE: `offset` may never run across line boundaries.
    getCurrentLocation(offset) {
      if (!this.options.sourceCodeLocationInfo) {
        return null;
      }
      return {
        startLine: this.preprocessor.line,
        startCol: this.preprocessor.col - offset,
        startOffset: this.preprocessor.offset - offset,
        endLine: -1,
        endCol: -1,
        endOffset: -1
      };
    }
    _runParsingLoop() {
      if (this.inLoop)
        return;
      this.inLoop = true;
      while (this.active && !this.paused) {
        this.consumedAfterSnapshot = 0;
        const cp = this._consume();
        if (!this._ensureHibernation()) {
          this._callState(cp);
        }
      }
      this.inLoop = false;
    }
    //API
    pause() {
      this.paused = true;
    }
    resume(writeCallback) {
      if (!this.paused) {
        throw new Error("Parser was already resumed");
      }
      this.paused = false;
      if (this.inLoop)
        return;
      this._runParsingLoop();
      if (!this.paused) {
        writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
      }
    }
    write(chunk, isLastChunk, writeCallback) {
      this.active = true;
      this.preprocessor.write(chunk, isLastChunk);
      this._runParsingLoop();
      if (!this.paused) {
        writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
      }
    }
    insertHtmlAtCurrentPos(chunk) {
      this.active = true;
      this.preprocessor.insertHtmlAtCurrentPos(chunk);
      this._runParsingLoop();
    }
    //Hibernation
    _ensureHibernation() {
      if (this.preprocessor.endOfChunkHit) {
        this._unconsume(this.consumedAfterSnapshot);
        this.active = false;
        return true;
      }
      return false;
    }
    //Consumption
    _consume() {
      this.consumedAfterSnapshot++;
      return this.preprocessor.advance();
    }
    _unconsume(count) {
      this.consumedAfterSnapshot -= count;
      this.preprocessor.retreat(count);
    }
    _reconsumeInState(state, cp) {
      this.state = state;
      this._callState(cp);
    }
    _advanceBy(count) {
      this.consumedAfterSnapshot += count;
      for (let i2 = 0; i2 < count; i2++) {
        this.preprocessor.advance();
      }
    }
    _consumeSequenceIfMatch(pattern, caseSensitive) {
      if (this.preprocessor.startsWith(pattern, caseSensitive)) {
        this._advanceBy(pattern.length - 1);
        return true;
      }
      return false;
    }
    //Token creation
    _createStartTagToken() {
      this.currentToken = {
        type: TokenType.START_TAG,
        tagName: "",
        tagID: TAG_ID.UNKNOWN,
        selfClosing: false,
        ackSelfClosing: false,
        attrs: [],
        location: this.getCurrentLocation(1)
      };
    }
    _createEndTagToken() {
      this.currentToken = {
        type: TokenType.END_TAG,
        tagName: "",
        tagID: TAG_ID.UNKNOWN,
        selfClosing: false,
        ackSelfClosing: false,
        attrs: [],
        location: this.getCurrentLocation(2)
      };
    }
    _createCommentToken(offset) {
      this.currentToken = {
        type: TokenType.COMMENT,
        data: "",
        location: this.getCurrentLocation(offset)
      };
    }
    _createDoctypeToken(initialName) {
      this.currentToken = {
        type: TokenType.DOCTYPE,
        name: initialName,
        forceQuirks: false,
        publicId: null,
        systemId: null,
        location: this.currentLocation
      };
    }
    _createCharacterToken(type2, chars) {
      this.currentCharacterToken = {
        type: type2,
        chars,
        location: this.currentLocation
      };
    }
    //Tag attributes
    _createAttr(attrNameFirstCh) {
      this.currentAttr = {
        name: attrNameFirstCh,
        value: ""
      };
      this.currentLocation = this.getCurrentLocation(0);
    }
    _leaveAttrName() {
      var _a2;
      var _b;
      const token = this.currentToken;
      if (getTokenAttr(token, this.currentAttr.name) === null) {
        token.attrs.push(this.currentAttr);
        if (token.location && this.currentLocation) {
          const attrLocations = (_a2 = (_b = token.location).attrs) !== null && _a2 !== void 0 ? _a2 : _b.attrs = /* @__PURE__ */ Object.create(null);
          attrLocations[this.currentAttr.name] = this.currentLocation;
          this._leaveAttrValue();
        }
      } else {
        this._err(ERR.duplicateAttribute);
      }
    }
    _leaveAttrValue() {
      if (this.currentLocation) {
        this.currentLocation.endLine = this.preprocessor.line;
        this.currentLocation.endCol = this.preprocessor.col;
        this.currentLocation.endOffset = this.preprocessor.offset;
      }
    }
    //Token emission
    prepareToken(ct) {
      this._emitCurrentCharacterToken(ct.location);
      this.currentToken = null;
      if (ct.location) {
        ct.location.endLine = this.preprocessor.line;
        ct.location.endCol = this.preprocessor.col + 1;
        ct.location.endOffset = this.preprocessor.offset + 1;
      }
      this.currentLocation = this.getCurrentLocation(-1);
    }
    emitCurrentTagToken() {
      const ct = this.currentToken;
      this.prepareToken(ct);
      ct.tagID = getTagID(ct.tagName);
      if (ct.type === TokenType.START_TAG) {
        this.lastStartTagName = ct.tagName;
        this.handler.onStartTag(ct);
      } else {
        if (ct.attrs.length > 0) {
          this._err(ERR.endTagWithAttributes);
        }
        if (ct.selfClosing) {
          this._err(ERR.endTagWithTrailingSolidus);
        }
        this.handler.onEndTag(ct);
      }
      this.preprocessor.dropParsedChunk();
    }
    emitCurrentComment(ct) {
      this.prepareToken(ct);
      this.handler.onComment(ct);
      this.preprocessor.dropParsedChunk();
    }
    emitCurrentDoctype(ct) {
      this.prepareToken(ct);
      this.handler.onDoctype(ct);
      this.preprocessor.dropParsedChunk();
    }
    _emitCurrentCharacterToken(nextLocation) {
      if (this.currentCharacterToken) {
        if (nextLocation && this.currentCharacterToken.location) {
          this.currentCharacterToken.location.endLine = nextLocation.startLine;
          this.currentCharacterToken.location.endCol = nextLocation.startCol;
          this.currentCharacterToken.location.endOffset = nextLocation.startOffset;
        }
        switch (this.currentCharacterToken.type) {
          case TokenType.CHARACTER: {
            this.handler.onCharacter(this.currentCharacterToken);
            break;
          }
          case TokenType.NULL_CHARACTER: {
            this.handler.onNullCharacter(this.currentCharacterToken);
            break;
          }
          case TokenType.WHITESPACE_CHARACTER: {
            this.handler.onWhitespaceCharacter(this.currentCharacterToken);
            break;
          }
        }
        this.currentCharacterToken = null;
      }
    }
    _emitEOFToken() {
      const location = this.getCurrentLocation(0);
      if (location) {
        location.endLine = location.startLine;
        location.endCol = location.startCol;
        location.endOffset = location.startOffset;
      }
      this._emitCurrentCharacterToken(location);
      this.handler.onEof({ type: TokenType.EOF, location });
      this.active = false;
    }
    //Characters emission
    //OPTIMIZATION: specification uses only one type of character tokens (one token per character).
    //This causes a huge memory overhead and a lot of unnecessary parser loops. parse5 uses 3 groups of characters.
    //If we have a sequence of characters that belong to the same group, the parser can process it
    //as a single solid character token.
    //So, there are 3 types of character tokens in parse5:
    //1)TokenType.NULL_CHARACTER - \u0000-character sequences (e.g. '\u0000\u0000\u0000')
    //2)TokenType.WHITESPACE_CHARACTER - any whitespace/new-line character sequences (e.g. '\n  \r\t   \f')
    //3)TokenType.CHARACTER - any character sequence which don't belong to groups 1 and 2 (e.g. 'abcdef1234@@#$%^')
    _appendCharToCurrentCharacterToken(type2, ch) {
      if (this.currentCharacterToken) {
        if (this.currentCharacterToken.type !== type2) {
          this.currentLocation = this.getCurrentLocation(0);
          this._emitCurrentCharacterToken(this.currentLocation);
          this.preprocessor.dropParsedChunk();
        } else {
          this.currentCharacterToken.chars += ch;
          return;
        }
      }
      this._createCharacterToken(type2, ch);
    }
    _emitCodePoint(cp) {
      const type2 = isWhitespace$2(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER;
      this._appendCharToCurrentCharacterToken(type2, String.fromCodePoint(cp));
    }
    //NOTE: used when we emit characters explicitly.
    //This is always for non-whitespace and non-null characters, which allows us to avoid additional checks.
    _emitChars(ch) {
      this._appendCharToCurrentCharacterToken(TokenType.CHARACTER, ch);
    }
    // Character reference helpers
    _matchNamedCharacterReference(cp) {
      let result = null;
      let excess = 0;
      let withoutSemicolon = false;
      for (let i2 = 0, current = htmlDecodeTree[0]; i2 >= 0; cp = this._consume()) {
        i2 = determineBranch(htmlDecodeTree, current, i2 + 1, cp);
        if (i2 < 0)
          break;
        excess += 1;
        current = htmlDecodeTree[i2];
        const masked = current & BinTrieFlags.VALUE_LENGTH;
        if (masked) {
          const valueLength = (masked >> 14) - 1;
          if (cp !== CODE_POINTS.SEMICOLON && this._isCharacterReferenceInAttribute() && isEntityInAttributeInvalidEnd(this.preprocessor.peek(1))) {
            result = [CODE_POINTS.AMPERSAND];
            i2 += valueLength;
          } else {
            result = valueLength === 0 ? [htmlDecodeTree[i2] & ~BinTrieFlags.VALUE_LENGTH] : valueLength === 1 ? [htmlDecodeTree[++i2]] : [htmlDecodeTree[++i2], htmlDecodeTree[++i2]];
            excess = 0;
            withoutSemicolon = cp !== CODE_POINTS.SEMICOLON;
          }
          if (valueLength === 0) {
            this._consume();
            break;
          }
        }
      }
      this._unconsume(excess);
      if (withoutSemicolon && !this.preprocessor.endOfChunkHit) {
        this._err(ERR.missingSemicolonAfterCharacterReference);
      }
      this._unconsume(1);
      return result;
    }
    _isCharacterReferenceInAttribute() {
      return this.returnState === State$3.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === State$3.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === State$3.ATTRIBUTE_VALUE_UNQUOTED;
    }
    _flushCodePointConsumedAsCharacterReference(cp) {
      if (this._isCharacterReferenceInAttribute()) {
        this.currentAttr.value += String.fromCodePoint(cp);
      } else {
        this._emitCodePoint(cp);
      }
    }
    // Calling states this way turns out to be much faster than any other approach.
    _callState(cp) {
      switch (this.state) {
        case State$3.DATA: {
          this._stateData(cp);
          break;
        }
        case State$3.RCDATA: {
          this._stateRcdata(cp);
          break;
        }
        case State$3.RAWTEXT: {
          this._stateRawtext(cp);
          break;
        }
        case State$3.SCRIPT_DATA: {
          this._stateScriptData(cp);
          break;
        }
        case State$3.PLAINTEXT: {
          this._statePlaintext(cp);
          break;
        }
        case State$3.TAG_OPEN: {
          this._stateTagOpen(cp);
          break;
        }
        case State$3.END_TAG_OPEN: {
          this._stateEndTagOpen(cp);
          break;
        }
        case State$3.TAG_NAME: {
          this._stateTagName(cp);
          break;
        }
        case State$3.RCDATA_LESS_THAN_SIGN: {
          this._stateRcdataLessThanSign(cp);
          break;
        }
        case State$3.RCDATA_END_TAG_OPEN: {
          this._stateRcdataEndTagOpen(cp);
          break;
        }
        case State$3.RCDATA_END_TAG_NAME: {
          this._stateRcdataEndTagName(cp);
          break;
        }
        case State$3.RAWTEXT_LESS_THAN_SIGN: {
          this._stateRawtextLessThanSign(cp);
          break;
        }
        case State$3.RAWTEXT_END_TAG_OPEN: {
          this._stateRawtextEndTagOpen(cp);
          break;
        }
        case State$3.RAWTEXT_END_TAG_NAME: {
          this._stateRawtextEndTagName(cp);
          break;
        }
        case State$3.SCRIPT_DATA_LESS_THAN_SIGN: {
          this._stateScriptDataLessThanSign(cp);
          break;
        }
        case State$3.SCRIPT_DATA_END_TAG_OPEN: {
          this._stateScriptDataEndTagOpen(cp);
          break;
        }
        case State$3.SCRIPT_DATA_END_TAG_NAME: {
          this._stateScriptDataEndTagName(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPE_START: {
          this._stateScriptDataEscapeStart(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPE_START_DASH: {
          this._stateScriptDataEscapeStartDash(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED: {
          this._stateScriptDataEscaped(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED_DASH: {
          this._stateScriptDataEscapedDash(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED_DASH_DASH: {
          this._stateScriptDataEscapedDashDash(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: {
          this._stateScriptDataEscapedLessThanSign(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: {
          this._stateScriptDataEscapedEndTagOpen(cp);
          break;
        }
        case State$3.SCRIPT_DATA_ESCAPED_END_TAG_NAME: {
          this._stateScriptDataEscapedEndTagName(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPE_START: {
          this._stateScriptDataDoubleEscapeStart(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPED: {
          this._stateScriptDataDoubleEscaped(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: {
          this._stateScriptDataDoubleEscapedDash(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: {
          this._stateScriptDataDoubleEscapedDashDash(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: {
          this._stateScriptDataDoubleEscapedLessThanSign(cp);
          break;
        }
        case State$3.SCRIPT_DATA_DOUBLE_ESCAPE_END: {
          this._stateScriptDataDoubleEscapeEnd(cp);
          break;
        }
        case State$3.BEFORE_ATTRIBUTE_NAME: {
          this._stateBeforeAttributeName(cp);
          break;
        }
        case State$3.ATTRIBUTE_NAME: {
          this._stateAttributeName(cp);
          break;
        }
        case State$3.AFTER_ATTRIBUTE_NAME: {
          this._stateAfterAttributeName(cp);
          break;
        }
        case State$3.BEFORE_ATTRIBUTE_VALUE: {
          this._stateBeforeAttributeValue(cp);
          break;
        }
        case State$3.ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
          this._stateAttributeValueDoubleQuoted(cp);
          break;
        }
        case State$3.ATTRIBUTE_VALUE_SINGLE_QUOTED: {
          this._stateAttributeValueSingleQuoted(cp);
          break;
        }
        case State$3.ATTRIBUTE_VALUE_UNQUOTED: {
          this._stateAttributeValueUnquoted(cp);
          break;
        }
        case State$3.AFTER_ATTRIBUTE_VALUE_QUOTED: {
          this._stateAfterAttributeValueQuoted(cp);
          break;
        }
        case State$3.SELF_CLOSING_START_TAG: {
          this._stateSelfClosingStartTag(cp);
          break;
        }
        case State$3.BOGUS_COMMENT: {
          this._stateBogusComment(cp);
          break;
        }
        case State$3.MARKUP_DECLARATION_OPEN: {
          this._stateMarkupDeclarationOpen(cp);
          break;
        }
        case State$3.COMMENT_START: {
          this._stateCommentStart(cp);
          break;
        }
        case State$3.COMMENT_START_DASH: {
          this._stateCommentStartDash(cp);
          break;
        }
        case State$3.COMMENT: {
          this._stateComment(cp);
          break;
        }
        case State$3.COMMENT_LESS_THAN_SIGN: {
          this._stateCommentLessThanSign(cp);
          break;
        }
        case State$3.COMMENT_LESS_THAN_SIGN_BANG: {
          this._stateCommentLessThanSignBang(cp);
          break;
        }
        case State$3.COMMENT_LESS_THAN_SIGN_BANG_DASH: {
          this._stateCommentLessThanSignBangDash(cp);
          break;
        }
        case State$3.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
          this._stateCommentLessThanSignBangDashDash(cp);
          break;
        }
        case State$3.COMMENT_END_DASH: {
          this._stateCommentEndDash(cp);
          break;
        }
        case State$3.COMMENT_END: {
          this._stateCommentEnd(cp);
          break;
        }
        case State$3.COMMENT_END_BANG: {
          this._stateCommentEndBang(cp);
          break;
        }
        case State$3.DOCTYPE: {
          this._stateDoctype(cp);
          break;
        }
        case State$3.BEFORE_DOCTYPE_NAME: {
          this._stateBeforeDoctypeName(cp);
          break;
        }
        case State$3.DOCTYPE_NAME: {
          this._stateDoctypeName(cp);
          break;
        }
        case State$3.AFTER_DOCTYPE_NAME: {
          this._stateAfterDoctypeName(cp);
          break;
        }
        case State$3.AFTER_DOCTYPE_PUBLIC_KEYWORD: {
          this._stateAfterDoctypePublicKeyword(cp);
          break;
        }
        case State$3.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: {
          this._stateBeforeDoctypePublicIdentifier(cp);
          break;
        }
        case State$3.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: {
          this._stateDoctypePublicIdentifierDoubleQuoted(cp);
          break;
        }
        case State$3.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: {
          this._stateDoctypePublicIdentifierSingleQuoted(cp);
          break;
        }
        case State$3.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: {
          this._stateAfterDoctypePublicIdentifier(cp);
          break;
        }
        case State$3.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: {
          this._stateBetweenDoctypePublicAndSystemIdentifiers(cp);
          break;
        }
        case State$3.AFTER_DOCTYPE_SYSTEM_KEYWORD: {
          this._stateAfterDoctypeSystemKeyword(cp);
          break;
        }
        case State$3.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: {
          this._stateBeforeDoctypeSystemIdentifier(cp);
          break;
        }
        case State$3.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: {
          this._stateDoctypeSystemIdentifierDoubleQuoted(cp);
          break;
        }
        case State$3.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: {
          this._stateDoctypeSystemIdentifierSingleQuoted(cp);
          break;
        }
        case State$3.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: {
          this._stateAfterDoctypeSystemIdentifier(cp);
          break;
        }
        case State$3.BOGUS_DOCTYPE: {
          this._stateBogusDoctype(cp);
          break;
        }
        case State$3.CDATA_SECTION: {
          this._stateCdataSection(cp);
          break;
        }
        case State$3.CDATA_SECTION_BRACKET: {
          this._stateCdataSectionBracket(cp);
          break;
        }
        case State$3.CDATA_SECTION_END: {
          this._stateCdataSectionEnd(cp);
          break;
        }
        case State$3.CHARACTER_REFERENCE: {
          this._stateCharacterReference(cp);
          break;
        }
        case State$3.NAMED_CHARACTER_REFERENCE: {
          this._stateNamedCharacterReference(cp);
          break;
        }
        case State$3.AMBIGUOUS_AMPERSAND: {
          this._stateAmbiguousAmpersand(cp);
          break;
        }
        case State$3.NUMERIC_CHARACTER_REFERENCE: {
          this._stateNumericCharacterReference(cp);
          break;
        }
        case State$3.HEXADEMICAL_CHARACTER_REFERENCE_START: {
          this._stateHexademicalCharacterReferenceStart(cp);
          break;
        }
        case State$3.HEXADEMICAL_CHARACTER_REFERENCE: {
          this._stateHexademicalCharacterReference(cp);
          break;
        }
        case State$3.DECIMAL_CHARACTER_REFERENCE: {
          this._stateDecimalCharacterReference(cp);
          break;
        }
        case State$3.NUMERIC_CHARACTER_REFERENCE_END: {
          this._stateNumericCharacterReferenceEnd(cp);
          break;
        }
        default: {
          throw new Error("Unknown state");
        }
      }
    }
    // State machine
    // Data state
    //------------------------------------------------------------------
    _stateData(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.TAG_OPEN;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this.returnState = State$3.DATA;
          this.state = State$3.CHARACTER_REFERENCE;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitCodePoint(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    //  RCDATA state
    //------------------------------------------------------------------
    _stateRcdata(cp) {
      switch (cp) {
        case CODE_POINTS.AMPERSAND: {
          this.returnState = State$3.RCDATA;
          this.state = State$3.CHARACTER_REFERENCE;
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.RCDATA_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // RAWTEXT state
    //------------------------------------------------------------------
    _stateRawtext(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.RAWTEXT_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data state
    //------------------------------------------------------------------
    _stateScriptData(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // PLAINTEXT state
    //------------------------------------------------------------------
    _statePlaintext(cp) {
      switch (cp) {
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Tag open state
    //------------------------------------------------------------------
    _stateTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this._createStartTagToken();
        this.state = State$3.TAG_NAME;
        this._stateTagName(cp);
      } else
        switch (cp) {
          case CODE_POINTS.EXCLAMATION_MARK: {
            this.state = State$3.MARKUP_DECLARATION_OPEN;
            break;
          }
          case CODE_POINTS.SOLIDUS: {
            this.state = State$3.END_TAG_OPEN;
            break;
          }
          case CODE_POINTS.QUESTION_MARK: {
            this._err(ERR.unexpectedQuestionMarkInsteadOfTagName);
            this._createCommentToken(1);
            this.state = State$3.BOGUS_COMMENT;
            this._stateBogusComment(cp);
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofBeforeTagName);
            this._emitChars("<");
            this._emitEOFToken();
            break;
          }
          default: {
            this._err(ERR.invalidFirstCharacterOfTagName);
            this._emitChars("<");
            this.state = State$3.DATA;
            this._stateData(cp);
          }
        }
    }
    // End tag open state
    //------------------------------------------------------------------
    _stateEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this._createEndTagToken();
        this.state = State$3.TAG_NAME;
        this._stateTagName(cp);
      } else
        switch (cp) {
          case CODE_POINTS.GREATER_THAN_SIGN: {
            this._err(ERR.missingEndTagName);
            this.state = State$3.DATA;
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofBeforeTagName);
            this._emitChars("</");
            this._emitEOFToken();
            break;
          }
          default: {
            this._err(ERR.invalidFirstCharacterOfTagName);
            this._createCommentToken(2);
            this.state = State$3.BOGUS_COMMENT;
            this._stateBogusComment(cp);
          }
        }
    }
    // Tag name state
    //------------------------------------------------------------------
    _stateTagName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State$3.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.tagName += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          token.tagName += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // RCDATA less-than sign state
    //------------------------------------------------------------------
    _stateRcdataLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State$3.RCDATA_END_TAG_OPEN;
      } else {
        this._emitChars("<");
        this.state = State$3.RCDATA;
        this._stateRcdata(cp);
      }
    }
    // RCDATA end tag open state
    //------------------------------------------------------------------
    _stateRcdataEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State$3.RCDATA_END_TAG_NAME;
        this._stateRcdataEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State$3.RCDATA;
        this._stateRcdata(cp);
      }
    }
    handleSpecialEndTag(_cp) {
      if (!this.preprocessor.startsWith(this.lastStartTagName, false)) {
        return !this._ensureHibernation();
      }
      this._createEndTagToken();
      const token = this.currentToken;
      token.tagName = this.lastStartTagName;
      const cp = this.preprocessor.peek(this.lastStartTagName.length);
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._advanceBy(this.lastStartTagName.length);
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          return false;
        }
        case CODE_POINTS.SOLIDUS: {
          this._advanceBy(this.lastStartTagName.length);
          this.state = State$3.SELF_CLOSING_START_TAG;
          return false;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._advanceBy(this.lastStartTagName.length);
          this.emitCurrentTagToken();
          this.state = State$3.DATA;
          return false;
        }
        default: {
          return !this._ensureHibernation();
        }
      }
    }
    // RCDATA end tag name state
    //------------------------------------------------------------------
    _stateRcdataEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State$3.RCDATA;
        this._stateRcdata(cp);
      }
    }
    // RAWTEXT less-than sign state
    //------------------------------------------------------------------
    _stateRawtextLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State$3.RAWTEXT_END_TAG_OPEN;
      } else {
        this._emitChars("<");
        this.state = State$3.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // RAWTEXT end tag open state
    //------------------------------------------------------------------
    _stateRawtextEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State$3.RAWTEXT_END_TAG_NAME;
        this._stateRawtextEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State$3.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // RAWTEXT end tag name state
    //------------------------------------------------------------------
    _stateRawtextEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State$3.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // Script data less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataLessThanSign(cp) {
      switch (cp) {
        case CODE_POINTS.SOLIDUS: {
          this.state = State$3.SCRIPT_DATA_END_TAG_OPEN;
          break;
        }
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State$3.SCRIPT_DATA_ESCAPE_START;
          this._emitChars("<!");
          break;
        }
        default: {
          this._emitChars("<");
          this.state = State$3.SCRIPT_DATA;
          this._stateScriptData(cp);
        }
      }
    }
    // Script data end tag open state
    //------------------------------------------------------------------
    _stateScriptDataEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State$3.SCRIPT_DATA_END_TAG_NAME;
        this._stateScriptDataEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State$3.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data end tag name state
    //------------------------------------------------------------------
    _stateScriptDataEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State$3.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escape start state
    //------------------------------------------------------------------
    _stateScriptDataEscapeStart(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State$3.SCRIPT_DATA_ESCAPE_START_DASH;
        this._emitChars("-");
      } else {
        this.state = State$3.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escape start dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapeStartDash(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State$3.SCRIPT_DATA_ESCAPED_DASH_DASH;
        this._emitChars("-");
      } else {
        this.state = State$3.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escaped state
    //------------------------------------------------------------------
    _stateScriptDataEscaped(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.SCRIPT_DATA_ESCAPED_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapedDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.SCRIPT_DATA_ESCAPED_DASH_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State$3.SCRIPT_DATA_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State$3.SCRIPT_DATA_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped dash dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapedDashDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA;
          this._emitChars(">");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State$3.SCRIPT_DATA_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State$3.SCRIPT_DATA_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataEscapedLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State$3.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
      } else if (isAsciiLetter(cp)) {
        this._emitChars("<");
        this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPE_START;
        this._stateScriptDataDoubleEscapeStart(cp);
      } else {
        this._emitChars("<");
        this.state = State$3.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data escaped end tag open state
    //------------------------------------------------------------------
    _stateScriptDataEscapedEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State$3.SCRIPT_DATA_ESCAPED_END_TAG_NAME;
        this._stateScriptDataEscapedEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State$3.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data escaped end tag name state
    //------------------------------------------------------------------
    _stateScriptDataEscapedEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State$3.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data double escape start state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapeStart(cp) {
      if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
        this._emitCodePoint(cp);
        for (let i2 = 0; i2 < SEQUENCES.SCRIPT.length; i2++) {
          this._emitCodePoint(this._consume());
        }
        this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
      } else if (!this._ensureHibernation()) {
        this.state = State$3.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data double escaped state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscaped(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped dash state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped dash dash state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedDashDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.SCRIPT_DATA;
          this._emitChars(">");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPE_END;
        this._emitChars("/");
      } else {
        this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._stateScriptDataDoubleEscaped(cp);
      }
    }
    // Script data double escape end state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapeEnd(cp) {
      if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
        this._emitCodePoint(cp);
        for (let i2 = 0; i2 < SEQUENCES.SCRIPT.length; i2++) {
          this._emitCodePoint(this._consume());
        }
        this.state = State$3.SCRIPT_DATA_ESCAPED;
      } else if (!this._ensureHibernation()) {
        this.state = State$3.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._stateScriptDataDoubleEscaped(cp);
      }
    }
    // Before attribute name state
    //------------------------------------------------------------------
    _stateBeforeAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.SOLIDUS:
        case CODE_POINTS.GREATER_THAN_SIGN:
        case CODE_POINTS.EOF: {
          this.state = State$3.AFTER_ATTRIBUTE_NAME;
          this._stateAfterAttributeName(cp);
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this._err(ERR.unexpectedEqualsSignBeforeAttributeName);
          this._createAttr("=");
          this.state = State$3.ATTRIBUTE_NAME;
          break;
        }
        default: {
          this._createAttr("");
          this.state = State$3.ATTRIBUTE_NAME;
          this._stateAttributeName(cp);
        }
      }
    }
    // Attribute name state
    //------------------------------------------------------------------
    _stateAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED:
        case CODE_POINTS.SOLIDUS:
        case CODE_POINTS.GREATER_THAN_SIGN:
        case CODE_POINTS.EOF: {
          this._leaveAttrName();
          this.state = State$3.AFTER_ATTRIBUTE_NAME;
          this._stateAfterAttributeName(cp);
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this._leaveAttrName();
          this.state = State$3.BEFORE_ATTRIBUTE_VALUE;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK:
        case CODE_POINTS.APOSTROPHE:
        case CODE_POINTS.LESS_THAN_SIGN: {
          this._err(ERR.unexpectedCharacterInAttributeName);
          this.currentAttr.name += String.fromCodePoint(cp);
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.name += REPLACEMENT_CHARACTER;
          break;
        }
        default: {
          this.currentAttr.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // After attribute name state
    //------------------------------------------------------------------
    _stateAfterAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State$3.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this.state = State$3.BEFORE_ATTRIBUTE_VALUE;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._createAttr("");
          this.state = State$3.ATTRIBUTE_NAME;
          this._stateAttributeName(cp);
        }
      }
    }
    // Before attribute value state
    //------------------------------------------------------------------
    _stateBeforeAttributeValue(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State$3.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this.state = State$3.ATTRIBUTE_VALUE_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingAttributeValue);
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        default: {
          this.state = State$3.ATTRIBUTE_VALUE_UNQUOTED;
          this._stateAttributeValueUnquoted(cp);
        }
      }
    }
    // Attribute value (double-quoted) state
    //------------------------------------------------------------------
    _stateAttributeValueDoubleQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State$3.AFTER_ATTRIBUTE_VALUE_QUOTED;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this.returnState = State$3.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
          this.state = State$3.CHARACTER_REFERENCE;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // Attribute value (single-quoted) state
    //------------------------------------------------------------------
    _stateAttributeValueSingleQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State$3.AFTER_ATTRIBUTE_VALUE_QUOTED;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this.returnState = State$3.ATTRIBUTE_VALUE_SINGLE_QUOTED;
          this.state = State$3.CHARACTER_REFERENCE;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // Attribute value (unquoted) state
    //------------------------------------------------------------------
    _stateAttributeValueUnquoted(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._leaveAttrValue();
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this.returnState = State$3.ATTRIBUTE_VALUE_UNQUOTED;
          this.state = State$3.CHARACTER_REFERENCE;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._leaveAttrValue();
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK:
        case CODE_POINTS.APOSTROPHE:
        case CODE_POINTS.LESS_THAN_SIGN:
        case CODE_POINTS.EQUALS_SIGN:
        case CODE_POINTS.GRAVE_ACCENT: {
          this._err(ERR.unexpectedCharacterInUnquotedAttributeValue);
          this.currentAttr.value += String.fromCodePoint(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // After attribute value (quoted) state
    //------------------------------------------------------------------
    _stateAfterAttributeValueQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._leaveAttrValue();
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this._leaveAttrValue();
          this.state = State$3.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._leaveAttrValue();
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingWhitespaceBetweenAttributes);
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          this._stateBeforeAttributeName(cp);
        }
      }
    }
    // Self-closing start tag state
    //------------------------------------------------------------------
    _stateSelfClosingStartTag(cp) {
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          const token = this.currentToken;
          token.selfClosing = true;
          this.state = State$3.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.unexpectedSolidusInTag);
          this.state = State$3.BEFORE_ATTRIBUTE_NAME;
          this._stateBeforeAttributeName(cp);
        }
      }
    }
    // Bogus comment state
    //------------------------------------------------------------------
    _stateBogusComment(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.data += REPLACEMENT_CHARACTER;
          break;
        }
        default: {
          token.data += String.fromCodePoint(cp);
        }
      }
    }
    // Markup declaration open state
    //------------------------------------------------------------------
    _stateMarkupDeclarationOpen(cp) {
      if (this._consumeSequenceIfMatch(SEQUENCES.DASH_DASH, true)) {
        this._createCommentToken(SEQUENCES.DASH_DASH.length + 1);
        this.state = State$3.COMMENT_START;
      } else if (this._consumeSequenceIfMatch(SEQUENCES.DOCTYPE, false)) {
        this.currentLocation = this.getCurrentLocation(SEQUENCES.DOCTYPE.length + 1);
        this.state = State$3.DOCTYPE;
      } else if (this._consumeSequenceIfMatch(SEQUENCES.CDATA_START, true)) {
        if (this.inForeignNode) {
          this.state = State$3.CDATA_SECTION;
        } else {
          this._err(ERR.cdataInHtmlContent);
          this._createCommentToken(SEQUENCES.CDATA_START.length + 1);
          this.currentToken.data = "[CDATA[";
          this.state = State$3.BOGUS_COMMENT;
        }
      } else if (!this._ensureHibernation()) {
        this._err(ERR.incorrectlyOpenedComment);
        this._createCommentToken(2);
        this.state = State$3.BOGUS_COMMENT;
        this._stateBogusComment(cp);
      }
    }
    // Comment start state
    //------------------------------------------------------------------
    _stateCommentStart(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.COMMENT_START_DASH;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptClosingOfEmptyComment);
          this.state = State$3.DATA;
          const token = this.currentToken;
          this.emitCurrentComment(token);
          break;
        }
        default: {
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment start dash state
    //------------------------------------------------------------------
    _stateCommentStartDash(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.COMMENT_END;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptClosingOfEmptyComment);
          this.state = State$3.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "-";
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment state
    //------------------------------------------------------------------
    _stateComment(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.COMMENT_END_DASH;
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          token.data += "<";
          this.state = State$3.COMMENT_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.data += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += String.fromCodePoint(cp);
        }
      }
    }
    // Comment less-than sign state
    //------------------------------------------------------------------
    _stateCommentLessThanSign(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.EXCLAMATION_MARK: {
          token.data += "!";
          this.state = State$3.COMMENT_LESS_THAN_SIGN_BANG;
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          token.data += "<";
          break;
        }
        default: {
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment less-than sign bang state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBang(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State$3.COMMENT_LESS_THAN_SIGN_BANG_DASH;
      } else {
        this.state = State$3.COMMENT;
        this._stateComment(cp);
      }
    }
    // Comment less-than sign bang dash state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBangDash(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State$3.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
      } else {
        this.state = State$3.COMMENT_END_DASH;
        this._stateCommentEndDash(cp);
      }
    }
    // Comment less-than sign bang dash dash state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBangDashDash(cp) {
      if (cp !== CODE_POINTS.GREATER_THAN_SIGN && cp !== CODE_POINTS.EOF) {
        this._err(ERR.nestedComment);
      }
      this.state = State$3.COMMENT_END;
      this._stateCommentEnd(cp);
    }
    // Comment end dash state
    //------------------------------------------------------------------
    _stateCommentEndDash(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State$3.COMMENT_END;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "-";
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment end state
    //------------------------------------------------------------------
    _stateCommentEnd(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State$3.COMMENT_END_BANG;
          break;
        }
        case CODE_POINTS.HYPHEN_MINUS: {
          token.data += "-";
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "--";
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment end bang state
    //------------------------------------------------------------------
    _stateCommentEndBang(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          token.data += "--!";
          this.state = State$3.COMMENT_END_DASH;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.incorrectlyClosedComment);
          this.state = State$3.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "--!";
          this.state = State$3.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // DOCTYPE state
    //------------------------------------------------------------------
    _stateDoctype(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.BEFORE_DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.BEFORE_DOCTYPE_NAME;
          this._stateBeforeDoctypeName(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingWhitespaceBeforeDoctypeName);
          this.state = State$3.BEFORE_DOCTYPE_NAME;
          this._stateBeforeDoctypeName(cp);
        }
      }
    }
    // Before DOCTYPE name state
    //------------------------------------------------------------------
    _stateBeforeDoctypeName(cp) {
      if (isAsciiUpper(cp)) {
        this._createDoctypeToken(String.fromCharCode(toAsciiLower(cp)));
        this.state = State$3.DOCTYPE_NAME;
      } else
        switch (cp) {
          case CODE_POINTS.SPACE:
          case CODE_POINTS.LINE_FEED:
          case CODE_POINTS.TABULATION:
          case CODE_POINTS.FORM_FEED: {
            break;
          }
          case CODE_POINTS.NULL: {
            this._err(ERR.unexpectedNullCharacter);
            this._createDoctypeToken(REPLACEMENT_CHARACTER);
            this.state = State$3.DOCTYPE_NAME;
            break;
          }
          case CODE_POINTS.GREATER_THAN_SIGN: {
            this._err(ERR.missingDoctypeName);
            this._createDoctypeToken(null);
            const token = this.currentToken;
            token.forceQuirks = true;
            this.emitCurrentDoctype(token);
            this.state = State$3.DATA;
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofInDoctype);
            this._createDoctypeToken(null);
            const token = this.currentToken;
            token.forceQuirks = true;
            this.emitCurrentDoctype(token);
            this._emitEOFToken();
            break;
          }
          default: {
            this._createDoctypeToken(String.fromCodePoint(cp));
            this.state = State$3.DOCTYPE_NAME;
          }
        }
    }
    // DOCTYPE name state
    //------------------------------------------------------------------
    _stateDoctypeName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.AFTER_DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.name += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // After DOCTYPE name state
    //------------------------------------------------------------------
    _stateAfterDoctypeName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          if (this._consumeSequenceIfMatch(SEQUENCES.PUBLIC, false)) {
            this.state = State$3.AFTER_DOCTYPE_PUBLIC_KEYWORD;
          } else if (this._consumeSequenceIfMatch(SEQUENCES.SYSTEM, false)) {
            this.state = State$3.AFTER_DOCTYPE_SYSTEM_KEYWORD;
          } else if (!this._ensureHibernation()) {
            this._err(ERR.invalidCharacterSequenceAfterDoctypeName);
            token.forceQuirks = true;
            this.state = State$3.BOGUS_DOCTYPE;
            this._stateBogusDoctype(cp);
          }
        }
      }
    }
    // After DOCTYPE public keyword state
    //------------------------------------------------------------------
    _stateAfterDoctypePublicKeyword(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
          token.publicId = "";
          this.state = State$3.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
          token.publicId = "";
          this.state = State$3.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Before DOCTYPE public identifier state
    //------------------------------------------------------------------
    _stateBeforeDoctypePublicIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.publicId = "";
          this.state = State$3.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.publicId = "";
          this.state = State$3.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // DOCTYPE public identifier (double-quoted) state
    //------------------------------------------------------------------
    _stateDoctypePublicIdentifierDoubleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State$3.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.publicId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.publicId += String.fromCodePoint(cp);
        }
      }
    }
    // DOCTYPE public identifier (single-quoted) state
    //------------------------------------------------------------------
    _stateDoctypePublicIdentifierSingleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State$3.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.publicId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.publicId += String.fromCodePoint(cp);
        }
      }
    }
    // After DOCTYPE public identifier state
    //------------------------------------------------------------------
    _stateAfterDoctypePublicIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Between DOCTYPE public and system identifiers state
    //------------------------------------------------------------------
    _stateBetweenDoctypePublicAndSystemIdentifiers(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // After DOCTYPE system keyword state
    //------------------------------------------------------------------
    _stateAfterDoctypeSystemKeyword(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State$3.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Before DOCTYPE system identifier state
    //------------------------------------------------------------------
    _stateBeforeDoctypeSystemIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.systemId = "";
          this.state = State$3.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // DOCTYPE system identifier (double-quoted) state
    //------------------------------------------------------------------
    _stateDoctypeSystemIdentifierDoubleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State$3.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.systemId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.systemId += String.fromCodePoint(cp);
        }
      }
    }
    // DOCTYPE system identifier (single-quoted) state
    //------------------------------------------------------------------
    _stateDoctypeSystemIdentifierSingleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State$3.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.systemId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.systemId += String.fromCodePoint(cp);
        }
      }
    }
    // After DOCTYPE system identifier state
    //------------------------------------------------------------------
    _stateAfterDoctypeSystemIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.unexpectedCharacterAfterDoctypeSystemIdentifier);
          this.state = State$3.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Bogus DOCTYPE state
    //------------------------------------------------------------------
    _stateBogusDoctype(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          break;
        }
        case CODE_POINTS.EOF: {
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
      }
    }
    // CDATA section state
    //------------------------------------------------------------------
    _stateCdataSection(cp) {
      switch (cp) {
        case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
          this.state = State$3.CDATA_SECTION_BRACKET;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInCdata);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // CDATA section bracket state
    //------------------------------------------------------------------
    _stateCdataSectionBracket(cp) {
      if (cp === CODE_POINTS.RIGHT_SQUARE_BRACKET) {
        this.state = State$3.CDATA_SECTION_END;
      } else {
        this._emitChars("]");
        this.state = State$3.CDATA_SECTION;
        this._stateCdataSection(cp);
      }
    }
    // CDATA section end state
    //------------------------------------------------------------------
    _stateCdataSectionEnd(cp) {
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State$3.DATA;
          break;
        }
        case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
          this._emitChars("]");
          break;
        }
        default: {
          this._emitChars("]]");
          this.state = State$3.CDATA_SECTION;
          this._stateCdataSection(cp);
        }
      }
    }
    // Character reference state
    //------------------------------------------------------------------
    _stateCharacterReference(cp) {
      if (cp === CODE_POINTS.NUMBER_SIGN) {
        this.state = State$3.NUMERIC_CHARACTER_REFERENCE;
      } else if (isAsciiAlphaNumeric(cp)) {
        this.state = State$3.NAMED_CHARACTER_REFERENCE;
        this._stateNamedCharacterReference(cp);
      } else {
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
        this._reconsumeInState(this.returnState, cp);
      }
    }
    // Named character reference state
    //------------------------------------------------------------------
    _stateNamedCharacterReference(cp) {
      const matchResult = this._matchNamedCharacterReference(cp);
      if (this._ensureHibernation())
        ;
      else if (matchResult) {
        for (let i2 = 0; i2 < matchResult.length; i2++) {
          this._flushCodePointConsumedAsCharacterReference(matchResult[i2]);
        }
        this.state = this.returnState;
      } else {
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
        this.state = State$3.AMBIGUOUS_AMPERSAND;
      }
    }
    // Ambiguos ampersand state
    //------------------------------------------------------------------
    _stateAmbiguousAmpersand(cp) {
      if (isAsciiAlphaNumeric(cp)) {
        this._flushCodePointConsumedAsCharacterReference(cp);
      } else {
        if (cp === CODE_POINTS.SEMICOLON) {
          this._err(ERR.unknownNamedCharacterReference);
        }
        this._reconsumeInState(this.returnState, cp);
      }
    }
    // Numeric character reference state
    //------------------------------------------------------------------
    _stateNumericCharacterReference(cp) {
      this.charRefCode = 0;
      if (cp === CODE_POINTS.LATIN_SMALL_X || cp === CODE_POINTS.LATIN_CAPITAL_X) {
        this.state = State$3.HEXADEMICAL_CHARACTER_REFERENCE_START;
      } else if (isAsciiDigit(cp)) {
        this.state = State$3.DECIMAL_CHARACTER_REFERENCE;
        this._stateDecimalCharacterReference(cp);
      } else {
        this._err(ERR.absenceOfDigitsInNumericCharacterReference);
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.NUMBER_SIGN);
        this._reconsumeInState(this.returnState, cp);
      }
    }
    // Hexademical character reference start state
    //------------------------------------------------------------------
    _stateHexademicalCharacterReferenceStart(cp) {
      if (isAsciiHexDigit(cp)) {
        this.state = State$3.HEXADEMICAL_CHARACTER_REFERENCE;
        this._stateHexademicalCharacterReference(cp);
      } else {
        this._err(ERR.absenceOfDigitsInNumericCharacterReference);
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.NUMBER_SIGN);
        this._unconsume(2);
        this.state = this.returnState;
      }
    }
    // Hexademical character reference state
    //------------------------------------------------------------------
    _stateHexademicalCharacterReference(cp) {
      if (isAsciiUpperHexDigit(cp)) {
        this.charRefCode = this.charRefCode * 16 + cp - 55;
      } else if (isAsciiLowerHexDigit(cp)) {
        this.charRefCode = this.charRefCode * 16 + cp - 87;
      } else if (isAsciiDigit(cp)) {
        this.charRefCode = this.charRefCode * 16 + cp - 48;
      } else if (cp === CODE_POINTS.SEMICOLON) {
        this.state = State$3.NUMERIC_CHARACTER_REFERENCE_END;
      } else {
        this._err(ERR.missingSemicolonAfterCharacterReference);
        this.state = State$3.NUMERIC_CHARACTER_REFERENCE_END;
        this._stateNumericCharacterReferenceEnd(cp);
      }
    }
    // Decimal character reference state
    //------------------------------------------------------------------
    _stateDecimalCharacterReference(cp) {
      if (isAsciiDigit(cp)) {
        this.charRefCode = this.charRefCode * 10 + cp - 48;
      } else if (cp === CODE_POINTS.SEMICOLON) {
        this.state = State$3.NUMERIC_CHARACTER_REFERENCE_END;
      } else {
        this._err(ERR.missingSemicolonAfterCharacterReference);
        this.state = State$3.NUMERIC_CHARACTER_REFERENCE_END;
        this._stateNumericCharacterReferenceEnd(cp);
      }
    }
    // Numeric character reference end state
    //------------------------------------------------------------------
    _stateNumericCharacterReferenceEnd(cp) {
      if (this.charRefCode === CODE_POINTS.NULL) {
        this._err(ERR.nullCharacterReference);
        this.charRefCode = CODE_POINTS.REPLACEMENT_CHARACTER;
      } else if (this.charRefCode > 1114111) {
        this._err(ERR.characterReferenceOutsideUnicodeRange);
        this.charRefCode = CODE_POINTS.REPLACEMENT_CHARACTER;
      } else if (isSurrogate(this.charRefCode)) {
        this._err(ERR.surrogateCharacterReference);
        this.charRefCode = CODE_POINTS.REPLACEMENT_CHARACTER;
      } else if (isUndefinedCodePoint(this.charRefCode)) {
        this._err(ERR.noncharacterCharacterReference);
      } else if (isControlCodePoint(this.charRefCode) || this.charRefCode === CODE_POINTS.CARRIAGE_RETURN) {
        this._err(ERR.controlCharacterReference);
        const replacement = C1_CONTROLS_REFERENCE_REPLACEMENTS.get(this.charRefCode);
        if (replacement !== void 0) {
          this.charRefCode = replacement;
        }
      }
      this._flushCodePointConsumedAsCharacterReference(this.charRefCode);
      this._reconsumeInState(this.returnState, cp);
    }
  };
  const IMPLICIT_END_TAG_REQUIRED = /* @__PURE__ */ new Set([TAG_ID.DD, TAG_ID.DT, TAG_ID.LI, TAG_ID.OPTGROUP, TAG_ID.OPTION, TAG_ID.P, TAG_ID.RB, TAG_ID.RP, TAG_ID.RT, TAG_ID.RTC]);
  const IMPLICIT_END_TAG_REQUIRED_THOROUGHLY = /* @__PURE__ */ new Set([
    ...IMPLICIT_END_TAG_REQUIRED,
    TAG_ID.CAPTION,
    TAG_ID.COLGROUP,
    TAG_ID.TBODY,
    TAG_ID.TD,
    TAG_ID.TFOOT,
    TAG_ID.TH,
    TAG_ID.THEAD,
    TAG_ID.TR
  ]);
  const SCOPING_ELEMENT_NS = /* @__PURE__ */ new Map([
    [TAG_ID.APPLET, NS.HTML],
    [TAG_ID.CAPTION, NS.HTML],
    [TAG_ID.HTML, NS.HTML],
    [TAG_ID.MARQUEE, NS.HTML],
    [TAG_ID.OBJECT, NS.HTML],
    [TAG_ID.TABLE, NS.HTML],
    [TAG_ID.TD, NS.HTML],
    [TAG_ID.TEMPLATE, NS.HTML],
    [TAG_ID.TH, NS.HTML],
    [TAG_ID.ANNOTATION_XML, NS.MATHML],
    [TAG_ID.MI, NS.MATHML],
    [TAG_ID.MN, NS.MATHML],
    [TAG_ID.MO, NS.MATHML],
    [TAG_ID.MS, NS.MATHML],
    [TAG_ID.MTEXT, NS.MATHML],
    [TAG_ID.DESC, NS.SVG],
    [TAG_ID.FOREIGN_OBJECT, NS.SVG],
    [TAG_ID.TITLE, NS.SVG]
  ]);
  const NAMED_HEADERS = [TAG_ID.H1, TAG_ID.H2, TAG_ID.H3, TAG_ID.H4, TAG_ID.H5, TAG_ID.H6];
  const TABLE_ROW_CONTEXT = [TAG_ID.TR, TAG_ID.TEMPLATE, TAG_ID.HTML];
  const TABLE_BODY_CONTEXT = [TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TEMPLATE, TAG_ID.HTML];
  const TABLE_CONTEXT = [TAG_ID.TABLE, TAG_ID.TEMPLATE, TAG_ID.HTML];
  const TABLE_CELLS = [TAG_ID.TD, TAG_ID.TH];
  class OpenElementStack {
    get currentTmplContentOrNode() {
      return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
    }
    constructor(document2, treeAdapter, handler) {
      this.treeAdapter = treeAdapter;
      this.handler = handler;
      this.items = [];
      this.tagIDs = [];
      this.stackTop = -1;
      this.tmplCount = 0;
      this.currentTagId = TAG_ID.UNKNOWN;
      this.current = document2;
    }
    //Index of element
    _indexOf(element) {
      return this.items.lastIndexOf(element, this.stackTop);
    }
    //Update current element
    _isInTemplate() {
      return this.currentTagId === TAG_ID.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML;
    }
    _updateCurrentElement() {
      this.current = this.items[this.stackTop];
      this.currentTagId = this.tagIDs[this.stackTop];
    }
    //Mutations
    push(element, tagID) {
      this.stackTop++;
      this.items[this.stackTop] = element;
      this.current = element;
      this.tagIDs[this.stackTop] = tagID;
      this.currentTagId = tagID;
      if (this._isInTemplate()) {
        this.tmplCount++;
      }
      this.handler.onItemPush(element, tagID, true);
    }
    pop() {
      const popped = this.current;
      if (this.tmplCount > 0 && this._isInTemplate()) {
        this.tmplCount--;
      }
      this.stackTop--;
      this._updateCurrentElement();
      this.handler.onItemPop(popped, true);
    }
    replace(oldElement, newElement) {
      const idx = this._indexOf(oldElement);
      this.items[idx] = newElement;
      if (idx === this.stackTop) {
        this.current = newElement;
      }
    }
    insertAfter(referenceElement, newElement, newElementID) {
      const insertionIdx = this._indexOf(referenceElement) + 1;
      this.items.splice(insertionIdx, 0, newElement);
      this.tagIDs.splice(insertionIdx, 0, newElementID);
      this.stackTop++;
      if (insertionIdx === this.stackTop) {
        this._updateCurrentElement();
      }
      this.handler.onItemPush(this.current, this.currentTagId, insertionIdx === this.stackTop);
    }
    popUntilTagNamePopped(tagName) {
      let targetIdx = this.stackTop + 1;
      do {
        targetIdx = this.tagIDs.lastIndexOf(tagName, targetIdx - 1);
      } while (targetIdx > 0 && this.treeAdapter.getNamespaceURI(this.items[targetIdx]) !== NS.HTML);
      this.shortenToLength(targetIdx < 0 ? 0 : targetIdx);
    }
    shortenToLength(idx) {
      while (this.stackTop >= idx) {
        const popped = this.current;
        if (this.tmplCount > 0 && this._isInTemplate()) {
          this.tmplCount -= 1;
        }
        this.stackTop--;
        this._updateCurrentElement();
        this.handler.onItemPop(popped, this.stackTop < idx);
      }
    }
    popUntilElementPopped(element) {
      const idx = this._indexOf(element);
      this.shortenToLength(idx < 0 ? 0 : idx);
    }
    popUntilPopped(tagNames, targetNS) {
      const idx = this._indexOfTagNames(tagNames, targetNS);
      this.shortenToLength(idx < 0 ? 0 : idx);
    }
    popUntilNumberedHeaderPopped() {
      this.popUntilPopped(NAMED_HEADERS, NS.HTML);
    }
    popUntilTableCellPopped() {
      this.popUntilPopped(TABLE_CELLS, NS.HTML);
    }
    popAllUpToHtmlElement() {
      this.tmplCount = 0;
      this.shortenToLength(1);
    }
    _indexOfTagNames(tagNames, namespace) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        if (tagNames.includes(this.tagIDs[i2]) && this.treeAdapter.getNamespaceURI(this.items[i2]) === namespace) {
          return i2;
        }
      }
      return -1;
    }
    clearBackTo(tagNames, targetNS) {
      const idx = this._indexOfTagNames(tagNames, targetNS);
      this.shortenToLength(idx + 1);
    }
    clearBackToTableContext() {
      this.clearBackTo(TABLE_CONTEXT, NS.HTML);
    }
    clearBackToTableBodyContext() {
      this.clearBackTo(TABLE_BODY_CONTEXT, NS.HTML);
    }
    clearBackToTableRowContext() {
      this.clearBackTo(TABLE_ROW_CONTEXT, NS.HTML);
    }
    remove(element) {
      const idx = this._indexOf(element);
      if (idx >= 0) {
        if (idx === this.stackTop) {
          this.pop();
        } else {
          this.items.splice(idx, 1);
          this.tagIDs.splice(idx, 1);
          this.stackTop--;
          this._updateCurrentElement();
          this.handler.onItemPop(element, false);
        }
      }
    }
    //Search
    tryPeekProperlyNestedBodyElement() {
      return this.stackTop >= 1 && this.tagIDs[1] === TAG_ID.BODY ? this.items[1] : null;
    }
    contains(element) {
      return this._indexOf(element) > -1;
    }
    getCommonAncestor(element) {
      const elementIdx = this._indexOf(element) - 1;
      return elementIdx >= 0 ? this.items[elementIdx] : null;
    }
    isRootHtmlElementCurrent() {
      return this.stackTop === 0 && this.tagIDs[0] === TAG_ID.HTML;
    }
    //Element in scope
    hasInScope(tagName) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (tn === tagName && ns === NS.HTML) {
          return true;
        }
        if (SCOPING_ELEMENT_NS.get(tn) === ns) {
          return false;
        }
      }
      return true;
    }
    hasNumberedHeaderInScope() {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (isNumberedHeader(tn) && ns === NS.HTML) {
          return true;
        }
        if (SCOPING_ELEMENT_NS.get(tn) === ns) {
          return false;
        }
      }
      return true;
    }
    hasInListItemScope(tagName) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (tn === tagName && ns === NS.HTML) {
          return true;
        }
        if ((tn === TAG_ID.UL || tn === TAG_ID.OL) && ns === NS.HTML || SCOPING_ELEMENT_NS.get(tn) === ns) {
          return false;
        }
      }
      return true;
    }
    hasInButtonScope(tagName) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (tn === tagName && ns === NS.HTML) {
          return true;
        }
        if (tn === TAG_ID.BUTTON && ns === NS.HTML || SCOPING_ELEMENT_NS.get(tn) === ns) {
          return false;
        }
      }
      return true;
    }
    hasInTableScope(tagName) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (ns !== NS.HTML) {
          continue;
        }
        if (tn === tagName) {
          return true;
        }
        if (tn === TAG_ID.TABLE || tn === TAG_ID.TEMPLATE || tn === TAG_ID.HTML) {
          return false;
        }
      }
      return true;
    }
    hasTableBodyContextInTableScope() {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (ns !== NS.HTML) {
          continue;
        }
        if (tn === TAG_ID.TBODY || tn === TAG_ID.THEAD || tn === TAG_ID.TFOOT) {
          return true;
        }
        if (tn === TAG_ID.TABLE || tn === TAG_ID.HTML) {
          return false;
        }
      }
      return true;
    }
    hasInSelectScope(tagName) {
      for (let i2 = this.stackTop; i2 >= 0; i2--) {
        const tn = this.tagIDs[i2];
        const ns = this.treeAdapter.getNamespaceURI(this.items[i2]);
        if (ns !== NS.HTML) {
          continue;
        }
        if (tn === tagName) {
          return true;
        }
        if (tn !== TAG_ID.OPTION && tn !== TAG_ID.OPTGROUP) {
          return false;
        }
      }
      return true;
    }
    //Implied end tags
    generateImpliedEndTags() {
      while (IMPLICIT_END_TAG_REQUIRED.has(this.currentTagId)) {
        this.pop();
      }
    }
    generateImpliedEndTagsThoroughly() {
      while (IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
        this.pop();
      }
    }
    generateImpliedEndTagsWithExclusion(exclusionId) {
      while (this.currentTagId !== exclusionId && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
        this.pop();
      }
    }
  }
  const NOAH_ARK_CAPACITY = 3;
  var EntryType;
  (function(EntryType2) {
    EntryType2[EntryType2["Marker"] = 0] = "Marker";
    EntryType2[EntryType2["Element"] = 1] = "Element";
  })(EntryType = EntryType || (EntryType = {}));
  const MARKER = { type: EntryType.Marker };
  class FormattingElementList {
    constructor(treeAdapter) {
      this.treeAdapter = treeAdapter;
      this.entries = [];
      this.bookmark = null;
    }
    //Noah Ark's condition
    //OPTIMIZATION: at first we try to find possible candidates for exclusion using
    //lightweight heuristics without thorough attributes check.
    _getNoahArkConditionCandidates(newElement, neAttrs) {
      const candidates = [];
      const neAttrsLength = neAttrs.length;
      const neTagName = this.treeAdapter.getTagName(newElement);
      const neNamespaceURI = this.treeAdapter.getNamespaceURI(newElement);
      for (let i2 = 0; i2 < this.entries.length; i2++) {
        const entry = this.entries[i2];
        if (entry.type === EntryType.Marker) {
          break;
        }
        const { element } = entry;
        if (this.treeAdapter.getTagName(element) === neTagName && this.treeAdapter.getNamespaceURI(element) === neNamespaceURI) {
          const elementAttrs = this.treeAdapter.getAttrList(element);
          if (elementAttrs.length === neAttrsLength) {
            candidates.push({ idx: i2, attrs: elementAttrs });
          }
        }
      }
      return candidates;
    }
    _ensureNoahArkCondition(newElement) {
      if (this.entries.length < NOAH_ARK_CAPACITY)
        return;
      const neAttrs = this.treeAdapter.getAttrList(newElement);
      const candidates = this._getNoahArkConditionCandidates(newElement, neAttrs);
      if (candidates.length < NOAH_ARK_CAPACITY)
        return;
      const neAttrsMap = new Map(neAttrs.map((neAttr) => [neAttr.name, neAttr.value]));
      let validCandidates = 0;
      for (let i2 = 0; i2 < candidates.length; i2++) {
        const candidate = candidates[i2];
        if (candidate.attrs.every((cAttr) => neAttrsMap.get(cAttr.name) === cAttr.value)) {
          validCandidates += 1;
          if (validCandidates >= NOAH_ARK_CAPACITY) {
            this.entries.splice(candidate.idx, 1);
          }
        }
      }
    }
    //Mutations
    insertMarker() {
      this.entries.unshift(MARKER);
    }
    pushElement(element, token) {
      this._ensureNoahArkCondition(element);
      this.entries.unshift({
        type: EntryType.Element,
        element,
        token
      });
    }
    insertElementAfterBookmark(element, token) {
      const bookmarkIdx = this.entries.indexOf(this.bookmark);
      this.entries.splice(bookmarkIdx, 0, {
        type: EntryType.Element,
        element,
        token
      });
    }
    removeEntry(entry) {
      const entryIndex = this.entries.indexOf(entry);
      if (entryIndex >= 0) {
        this.entries.splice(entryIndex, 1);
      }
    }
    /**
     * Clears the list of formatting elements up to the last marker.
     *
     * @see https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker
     */
    clearToLastMarker() {
      const markerIdx = this.entries.indexOf(MARKER);
      if (markerIdx >= 0) {
        this.entries.splice(0, markerIdx + 1);
      } else {
        this.entries.length = 0;
      }
    }
    //Search
    getElementEntryInScopeWithTagName(tagName) {
      const entry = this.entries.find((entry2) => entry2.type === EntryType.Marker || this.treeAdapter.getTagName(entry2.element) === tagName);
      return entry && entry.type === EntryType.Element ? entry : null;
    }
    getElementEntry(element) {
      return this.entries.find((entry) => entry.type === EntryType.Element && entry.element === element);
    }
  }
  function createTextNode$1(value) {
    return {
      nodeName: "#text",
      value,
      parentNode: null
    };
  }
  const defaultTreeAdapter = {
    //Node construction
    createDocument() {
      return {
        nodeName: "#document",
        mode: DOCUMENT_MODE.NO_QUIRKS,
        childNodes: []
      };
    },
    createDocumentFragment() {
      return {
        nodeName: "#document-fragment",
        childNodes: []
      };
    },
    createElement(tagName, namespaceURI, attrs) {
      return {
        nodeName: tagName,
        tagName,
        attrs,
        namespaceURI,
        childNodes: [],
        parentNode: null
      };
    },
    createCommentNode(data2) {
      return {
        nodeName: "#comment",
        data: data2,
        parentNode: null
      };
    },
    //Tree mutation
    appendChild(parentNode, newNode) {
      parentNode.childNodes.push(newNode);
      newNode.parentNode = parentNode;
    },
    insertBefore(parentNode, newNode, referenceNode) {
      const insertionIdx = parentNode.childNodes.indexOf(referenceNode);
      parentNode.childNodes.splice(insertionIdx, 0, newNode);
      newNode.parentNode = parentNode;
    },
    setTemplateContent(templateElement, contentElement) {
      templateElement.content = contentElement;
    },
    getTemplateContent(templateElement) {
      return templateElement.content;
    },
    setDocumentType(document2, name2, publicId, systemId) {
      const doctypeNode = document2.childNodes.find((node) => node.nodeName === "#documentType");
      if (doctypeNode) {
        doctypeNode.name = name2;
        doctypeNode.publicId = publicId;
        doctypeNode.systemId = systemId;
      } else {
        const node = {
          nodeName: "#documentType",
          name: name2,
          publicId,
          systemId,
          parentNode: null
        };
        defaultTreeAdapter.appendChild(document2, node);
      }
    },
    setDocumentMode(document2, mode) {
      document2.mode = mode;
    },
    getDocumentMode(document2) {
      return document2.mode;
    },
    detachNode(node) {
      if (node.parentNode) {
        const idx = node.parentNode.childNodes.indexOf(node);
        node.parentNode.childNodes.splice(idx, 1);
        node.parentNode = null;
      }
    },
    insertText(parentNode, text2) {
      if (parentNode.childNodes.length > 0) {
        const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];
        if (defaultTreeAdapter.isTextNode(prevNode)) {
          prevNode.value += text2;
          return;
        }
      }
      defaultTreeAdapter.appendChild(parentNode, createTextNode$1(text2));
    },
    insertTextBefore(parentNode, text2, referenceNode) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.indexOf(referenceNode) - 1];
      if (prevNode && defaultTreeAdapter.isTextNode(prevNode)) {
        prevNode.value += text2;
      } else {
        defaultTreeAdapter.insertBefore(parentNode, createTextNode$1(text2), referenceNode);
      }
    },
    adoptAttributes(recipient, attrs) {
      const recipientAttrsMap = new Set(recipient.attrs.map((attr2) => attr2.name));
      for (let j = 0; j < attrs.length; j++) {
        if (!recipientAttrsMap.has(attrs[j].name)) {
          recipient.attrs.push(attrs[j]);
        }
      }
    },
    //Tree traversing
    getFirstChild(node) {
      return node.childNodes[0];
    },
    getChildNodes(node) {
      return node.childNodes;
    },
    getParentNode(node) {
      return node.parentNode;
    },
    getAttrList(element) {
      return element.attrs;
    },
    //Node data
    getTagName(element) {
      return element.tagName;
    },
    getNamespaceURI(element) {
      return element.namespaceURI;
    },
    getTextNodeContent(textNode) {
      return textNode.value;
    },
    getCommentNodeContent(commentNode) {
      return commentNode.data;
    },
    getDocumentTypeNodeName(doctypeNode) {
      return doctypeNode.name;
    },
    getDocumentTypeNodePublicId(doctypeNode) {
      return doctypeNode.publicId;
    },
    getDocumentTypeNodeSystemId(doctypeNode) {
      return doctypeNode.systemId;
    },
    //Node types
    isTextNode(node) {
      return node.nodeName === "#text";
    },
    isCommentNode(node) {
      return node.nodeName === "#comment";
    },
    isDocumentTypeNode(node) {
      return node.nodeName === "#documentType";
    },
    isElementNode(node) {
      return Object.prototype.hasOwnProperty.call(node, "tagName");
    },
    // Source code location
    setNodeSourceCodeLocation(node, location) {
      node.sourceCodeLocation = location;
    },
    getNodeSourceCodeLocation(node) {
      return node.sourceCodeLocation;
    },
    updateNodeSourceCodeLocation(node, endLocation) {
      node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
    }
  };
  const VALID_DOCTYPE_NAME = "html";
  const VALID_SYSTEM_ID = "about:legacy-compat";
  const QUIRKS_MODE_SYSTEM_ID = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
  const QUIRKS_MODE_PUBLIC_ID_PREFIXES = [
    "+//silmaril//dtd html pro v0r11 19970101//",
    "-//as//dtd html 3.0 aswedit + extensions//",
    "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
    "-//ietf//dtd html 2.0 level 1//",
    "-//ietf//dtd html 2.0 level 2//",
    "-//ietf//dtd html 2.0 strict level 1//",
    "-//ietf//dtd html 2.0 strict level 2//",
    "-//ietf//dtd html 2.0 strict//",
    "-//ietf//dtd html 2.0//",
    "-//ietf//dtd html 2.1e//",
    "-//ietf//dtd html 3.0//",
    "-//ietf//dtd html 3.2 final//",
    "-//ietf//dtd html 3.2//",
    "-//ietf//dtd html 3//",
    "-//ietf//dtd html level 0//",
    "-//ietf//dtd html level 1//",
    "-//ietf//dtd html level 2//",
    "-//ietf//dtd html level 3//",
    "-//ietf//dtd html strict level 0//",
    "-//ietf//dtd html strict level 1//",
    "-//ietf//dtd html strict level 2//",
    "-//ietf//dtd html strict level 3//",
    "-//ietf//dtd html strict//",
    "-//ietf//dtd html//",
    "-//metrius//dtd metrius presentational//",
    "-//microsoft//dtd internet explorer 2.0 html strict//",
    "-//microsoft//dtd internet explorer 2.0 html//",
    "-//microsoft//dtd internet explorer 2.0 tables//",
    "-//microsoft//dtd internet explorer 3.0 html strict//",
    "-//microsoft//dtd internet explorer 3.0 html//",
    "-//microsoft//dtd internet explorer 3.0 tables//",
    "-//netscape comm. corp.//dtd html//",
    "-//netscape comm. corp.//dtd strict html//",
    "-//o'reilly and associates//dtd html 2.0//",
    "-//o'reilly and associates//dtd html extended 1.0//",
    "-//o'reilly and associates//dtd html extended relaxed 1.0//",
    "-//sq//dtd html 2.0 hotmetal + extensions//",
    "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
    "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
    "-//spyglass//dtd html 2.0 extended//",
    "-//sun microsystems corp.//dtd hotjava html//",
    "-//sun microsystems corp.//dtd hotjava strict html//",
    "-//w3c//dtd html 3 1995-03-24//",
    "-//w3c//dtd html 3.2 draft//",
    "-//w3c//dtd html 3.2 final//",
    "-//w3c//dtd html 3.2//",
    "-//w3c//dtd html 3.2s draft//",
    "-//w3c//dtd html 4.0 frameset//",
    "-//w3c//dtd html 4.0 transitional//",
    "-//w3c//dtd html experimental 19960712//",
    "-//w3c//dtd html experimental 970421//",
    "-//w3c//dtd w3 html//",
    "-//w3o//dtd w3 html 3.0//",
    "-//webtechs//dtd mozilla html 2.0//",
    "-//webtechs//dtd mozilla html//"
  ];
  const QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
    ...QUIRKS_MODE_PUBLIC_ID_PREFIXES,
    "-//w3c//dtd html 4.01 frameset//",
    "-//w3c//dtd html 4.01 transitional//"
  ];
  const QUIRKS_MODE_PUBLIC_IDS = /* @__PURE__ */ new Set([
    "-//w3o//dtd w3 html strict 3.0//en//",
    "-/w3c/dtd html 4.0 transitional/en",
    "html"
  ]);
  const LIMITED_QUIRKS_PUBLIC_ID_PREFIXES = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"];
  const LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
    ...LIMITED_QUIRKS_PUBLIC_ID_PREFIXES,
    "-//w3c//dtd html 4.01 frameset//",
    "-//w3c//dtd html 4.01 transitional//"
  ];
  function hasPrefix(publicId, prefixes) {
    return prefixes.some((prefix) => publicId.startsWith(prefix));
  }
  function isConforming(token) {
    return token.name === VALID_DOCTYPE_NAME && token.publicId === null && (token.systemId === null || token.systemId === VALID_SYSTEM_ID);
  }
  function getDocumentMode(token) {
    if (token.name !== VALID_DOCTYPE_NAME) {
      return DOCUMENT_MODE.QUIRKS;
    }
    const { systemId } = token;
    if (systemId && systemId.toLowerCase() === QUIRKS_MODE_SYSTEM_ID) {
      return DOCUMENT_MODE.QUIRKS;
    }
    let { publicId } = token;
    if (publicId !== null) {
      publicId = publicId.toLowerCase();
      if (QUIRKS_MODE_PUBLIC_IDS.has(publicId)) {
        return DOCUMENT_MODE.QUIRKS;
      }
      let prefixes = systemId === null ? QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES : QUIRKS_MODE_PUBLIC_ID_PREFIXES;
      if (hasPrefix(publicId, prefixes)) {
        return DOCUMENT_MODE.QUIRKS;
      }
      prefixes = systemId === null ? LIMITED_QUIRKS_PUBLIC_ID_PREFIXES : LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES;
      if (hasPrefix(publicId, prefixes)) {
        return DOCUMENT_MODE.LIMITED_QUIRKS;
      }
    }
    return DOCUMENT_MODE.NO_QUIRKS;
  }
  const MIME_TYPES = {
    TEXT_HTML: "text/html",
    APPLICATION_XML: "application/xhtml+xml"
  };
  const DEFINITION_URL_ATTR = "definitionurl";
  const ADJUSTED_DEFINITION_URL_ATTR = "definitionURL";
  const SVG_ATTRS_ADJUSTMENT_MAP = new Map([
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan"
  ].map((attr2) => [attr2.toLowerCase(), attr2]));
  const XML_ATTRS_ADJUSTMENT_MAP = /* @__PURE__ */ new Map([
    ["xlink:actuate", { prefix: "xlink", name: "actuate", namespace: NS.XLINK }],
    ["xlink:arcrole", { prefix: "xlink", name: "arcrole", namespace: NS.XLINK }],
    ["xlink:href", { prefix: "xlink", name: "href", namespace: NS.XLINK }],
    ["xlink:role", { prefix: "xlink", name: "role", namespace: NS.XLINK }],
    ["xlink:show", { prefix: "xlink", name: "show", namespace: NS.XLINK }],
    ["xlink:title", { prefix: "xlink", name: "title", namespace: NS.XLINK }],
    ["xlink:type", { prefix: "xlink", name: "type", namespace: NS.XLINK }],
    ["xml:base", { prefix: "xml", name: "base", namespace: NS.XML }],
    ["xml:lang", { prefix: "xml", name: "lang", namespace: NS.XML }],
    ["xml:space", { prefix: "xml", name: "space", namespace: NS.XML }],
    ["xmlns", { prefix: "", name: "xmlns", namespace: NS.XMLNS }],
    ["xmlns:xlink", { prefix: "xmlns", name: "xlink", namespace: NS.XMLNS }]
  ]);
  const SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map([
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath"
  ].map((tn) => [tn.toLowerCase(), tn]));
  const EXITS_FOREIGN_CONTENT = /* @__PURE__ */ new Set([
    TAG_ID.B,
    TAG_ID.BIG,
    TAG_ID.BLOCKQUOTE,
    TAG_ID.BODY,
    TAG_ID.BR,
    TAG_ID.CENTER,
    TAG_ID.CODE,
    TAG_ID.DD,
    TAG_ID.DIV,
    TAG_ID.DL,
    TAG_ID.DT,
    TAG_ID.EM,
    TAG_ID.EMBED,
    TAG_ID.H1,
    TAG_ID.H2,
    TAG_ID.H3,
    TAG_ID.H4,
    TAG_ID.H5,
    TAG_ID.H6,
    TAG_ID.HEAD,
    TAG_ID.HR,
    TAG_ID.I,
    TAG_ID.IMG,
    TAG_ID.LI,
    TAG_ID.LISTING,
    TAG_ID.MENU,
    TAG_ID.META,
    TAG_ID.NOBR,
    TAG_ID.OL,
    TAG_ID.P,
    TAG_ID.PRE,
    TAG_ID.RUBY,
    TAG_ID.S,
    TAG_ID.SMALL,
    TAG_ID.SPAN,
    TAG_ID.STRONG,
    TAG_ID.STRIKE,
    TAG_ID.SUB,
    TAG_ID.SUP,
    TAG_ID.TABLE,
    TAG_ID.TT,
    TAG_ID.U,
    TAG_ID.UL,
    TAG_ID.VAR
  ]);
  function causesExit(startTagToken) {
    const tn = startTagToken.tagID;
    const isFontWithAttrs = tn === TAG_ID.FONT && startTagToken.attrs.some(({ name: name2 }) => name2 === ATTRS.COLOR || name2 === ATTRS.SIZE || name2 === ATTRS.FACE);
    return isFontWithAttrs || EXITS_FOREIGN_CONTENT.has(tn);
  }
  function adjustTokenMathMLAttrs(token) {
    for (let i2 = 0; i2 < token.attrs.length; i2++) {
      if (token.attrs[i2].name === DEFINITION_URL_ATTR) {
        token.attrs[i2].name = ADJUSTED_DEFINITION_URL_ATTR;
        break;
      }
    }
  }
  function adjustTokenSVGAttrs(token) {
    for (let i2 = 0; i2 < token.attrs.length; i2++) {
      const adjustedAttrName = SVG_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i2].name);
      if (adjustedAttrName != null) {
        token.attrs[i2].name = adjustedAttrName;
      }
    }
  }
  function adjustTokenXMLAttrs(token) {
    for (let i2 = 0; i2 < token.attrs.length; i2++) {
      const adjustedAttrEntry = XML_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i2].name);
      if (adjustedAttrEntry) {
        token.attrs[i2].prefix = adjustedAttrEntry.prefix;
        token.attrs[i2].name = adjustedAttrEntry.name;
        token.attrs[i2].namespace = adjustedAttrEntry.namespace;
      }
    }
  }
  function adjustTokenSVGTagName(token) {
    const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(token.tagName);
    if (adjustedTagName != null) {
      token.tagName = adjustedTagName;
      token.tagID = getTagID(token.tagName);
    }
  }
  function isMathMLTextIntegrationPoint(tn, ns) {
    return ns === NS.MATHML && (tn === TAG_ID.MI || tn === TAG_ID.MO || tn === TAG_ID.MN || tn === TAG_ID.MS || tn === TAG_ID.MTEXT);
  }
  function isHtmlIntegrationPoint(tn, ns, attrs) {
    if (ns === NS.MATHML && tn === TAG_ID.ANNOTATION_XML) {
      for (let i2 = 0; i2 < attrs.length; i2++) {
        if (attrs[i2].name === ATTRS.ENCODING) {
          const value = attrs[i2].value.toLowerCase();
          return value === MIME_TYPES.TEXT_HTML || value === MIME_TYPES.APPLICATION_XML;
        }
      }
    }
    return ns === NS.SVG && (tn === TAG_ID.FOREIGN_OBJECT || tn === TAG_ID.DESC || tn === TAG_ID.TITLE);
  }
  function isIntegrationPoint(tn, ns, attrs, foreignNS) {
    return (!foreignNS || foreignNS === NS.HTML) && isHtmlIntegrationPoint(tn, ns, attrs) || (!foreignNS || foreignNS === NS.MATHML) && isMathMLTextIntegrationPoint(tn, ns);
  }
  const HIDDEN_INPUT_TYPE = "hidden";
  const AA_OUTER_LOOP_ITER = 8;
  const AA_INNER_LOOP_ITER = 3;
  var InsertionMode;
  (function(InsertionMode2) {
    InsertionMode2[InsertionMode2["INITIAL"] = 0] = "INITIAL";
    InsertionMode2[InsertionMode2["BEFORE_HTML"] = 1] = "BEFORE_HTML";
    InsertionMode2[InsertionMode2["BEFORE_HEAD"] = 2] = "BEFORE_HEAD";
    InsertionMode2[InsertionMode2["IN_HEAD"] = 3] = "IN_HEAD";
    InsertionMode2[InsertionMode2["IN_HEAD_NO_SCRIPT"] = 4] = "IN_HEAD_NO_SCRIPT";
    InsertionMode2[InsertionMode2["AFTER_HEAD"] = 5] = "AFTER_HEAD";
    InsertionMode2[InsertionMode2["IN_BODY"] = 6] = "IN_BODY";
    InsertionMode2[InsertionMode2["TEXT"] = 7] = "TEXT";
    InsertionMode2[InsertionMode2["IN_TABLE"] = 8] = "IN_TABLE";
    InsertionMode2[InsertionMode2["IN_TABLE_TEXT"] = 9] = "IN_TABLE_TEXT";
    InsertionMode2[InsertionMode2["IN_CAPTION"] = 10] = "IN_CAPTION";
    InsertionMode2[InsertionMode2["IN_COLUMN_GROUP"] = 11] = "IN_COLUMN_GROUP";
    InsertionMode2[InsertionMode2["IN_TABLE_BODY"] = 12] = "IN_TABLE_BODY";
    InsertionMode2[InsertionMode2["IN_ROW"] = 13] = "IN_ROW";
    InsertionMode2[InsertionMode2["IN_CELL"] = 14] = "IN_CELL";
    InsertionMode2[InsertionMode2["IN_SELECT"] = 15] = "IN_SELECT";
    InsertionMode2[InsertionMode2["IN_SELECT_IN_TABLE"] = 16] = "IN_SELECT_IN_TABLE";
    InsertionMode2[InsertionMode2["IN_TEMPLATE"] = 17] = "IN_TEMPLATE";
    InsertionMode2[InsertionMode2["AFTER_BODY"] = 18] = "AFTER_BODY";
    InsertionMode2[InsertionMode2["IN_FRAMESET"] = 19] = "IN_FRAMESET";
    InsertionMode2[InsertionMode2["AFTER_FRAMESET"] = 20] = "AFTER_FRAMESET";
    InsertionMode2[InsertionMode2["AFTER_AFTER_BODY"] = 21] = "AFTER_AFTER_BODY";
    InsertionMode2[InsertionMode2["AFTER_AFTER_FRAMESET"] = 22] = "AFTER_AFTER_FRAMESET";
  })(InsertionMode || (InsertionMode = {}));
  const BASE_LOC = {
    startLine: -1,
    startCol: -1,
    startOffset: -1,
    endLine: -1,
    endCol: -1,
    endOffset: -1
  };
  const TABLE_STRUCTURE_TAGS = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TR]);
  const defaultParserOptions = {
    scriptingEnabled: true,
    sourceCodeLocationInfo: false,
    treeAdapter: defaultTreeAdapter,
    onParseError: null
  };
  let Parser$1 = class Parser {
    constructor(options, document2, fragmentContext = null, scriptHandler = null) {
      this.fragmentContext = fragmentContext;
      this.scriptHandler = scriptHandler;
      this.currentToken = null;
      this.stopped = false;
      this.insertionMode = InsertionMode.INITIAL;
      this.originalInsertionMode = InsertionMode.INITIAL;
      this.headElement = null;
      this.formElement = null;
      this.currentNotInHTML = false;
      this.tmplInsertionModeStack = [];
      this.pendingCharacterTokens = [];
      this.hasNonWhitespacePendingCharacterToken = false;
      this.framesetOk = true;
      this.skipNextNewLine = false;
      this.fosterParentingEnabled = false;
      this.options = {
        ...defaultParserOptions,
        ...options
      };
      this.treeAdapter = this.options.treeAdapter;
      this.onParseError = this.options.onParseError;
      if (this.onParseError) {
        this.options.sourceCodeLocationInfo = true;
      }
      this.document = document2 !== null && document2 !== void 0 ? document2 : this.treeAdapter.createDocument();
      this.tokenizer = new Tokenizer$1(this.options, this);
      this.activeFormattingElements = new FormattingElementList(this.treeAdapter);
      this.fragmentContextID = fragmentContext ? getTagID(this.treeAdapter.getTagName(fragmentContext)) : TAG_ID.UNKNOWN;
      this._setContextModes(fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : this.document, this.fragmentContextID);
      this.openElements = new OpenElementStack(this.document, this.treeAdapter, this);
    }
    // API
    static parse(html2, options) {
      const parser = new this(options);
      parser.tokenizer.write(html2, true);
      return parser.document;
    }
    static getFragmentParser(fragmentContext, options) {
      const opts = {
        ...defaultParserOptions,
        ...options
      };
      fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : fragmentContext = opts.treeAdapter.createElement(TAG_NAMES.TEMPLATE, NS.HTML, []);
      const documentMock = opts.treeAdapter.createElement("documentmock", NS.HTML, []);
      const parser = new this(opts, documentMock, fragmentContext);
      if (parser.fragmentContextID === TAG_ID.TEMPLATE) {
        parser.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
      }
      parser._initTokenizerForFragmentParsing();
      parser._insertFakeRootElement();
      parser._resetInsertionMode();
      parser._findFormInFragmentContext();
      return parser;
    }
    getFragment() {
      const rootElement = this.treeAdapter.getFirstChild(this.document);
      const fragment = this.treeAdapter.createDocumentFragment();
      this._adoptNodes(rootElement, fragment);
      return fragment;
    }
    //Errors
    _err(token, code2, beforeToken) {
      var _a2;
      if (!this.onParseError)
        return;
      const loc = (_a2 = token.location) !== null && _a2 !== void 0 ? _a2 : BASE_LOC;
      const err = {
        code: code2,
        startLine: loc.startLine,
        startCol: loc.startCol,
        startOffset: loc.startOffset,
        endLine: beforeToken ? loc.startLine : loc.endLine,
        endCol: beforeToken ? loc.startCol : loc.endCol,
        endOffset: beforeToken ? loc.startOffset : loc.endOffset
      };
      this.onParseError(err);
    }
    //Stack events
    onItemPush(node, tid, isTop) {
      var _a2, _b;
      (_b = (_a2 = this.treeAdapter).onItemPush) === null || _b === void 0 ? void 0 : _b.call(_a2, node);
      if (isTop && this.openElements.stackTop > 0)
        this._setContextModes(node, tid);
    }
    onItemPop(node, isTop) {
      var _a2, _b;
      if (this.options.sourceCodeLocationInfo) {
        this._setEndLocation(node, this.currentToken);
      }
      (_b = (_a2 = this.treeAdapter).onItemPop) === null || _b === void 0 ? void 0 : _b.call(_a2, node, this.openElements.current);
      if (isTop) {
        let current;
        let currentTagId;
        if (this.openElements.stackTop === 0 && this.fragmentContext) {
          current = this.fragmentContext;
          currentTagId = this.fragmentContextID;
        } else {
          ({ current, currentTagId } = this.openElements);
        }
        this._setContextModes(current, currentTagId);
      }
    }
    _setContextModes(current, tid) {
      const isHTML = current === this.document || this.treeAdapter.getNamespaceURI(current) === NS.HTML;
      this.currentNotInHTML = !isHTML;
      this.tokenizer.inForeignNode = !isHTML && !this._isIntegrationPoint(tid, current);
    }
    _switchToTextParsing(currentToken, nextTokenizerState) {
      this._insertElement(currentToken, NS.HTML);
      this.tokenizer.state = nextTokenizerState;
      this.originalInsertionMode = this.insertionMode;
      this.insertionMode = InsertionMode.TEXT;
    }
    switchToPlaintextParsing() {
      this.insertionMode = InsertionMode.TEXT;
      this.originalInsertionMode = InsertionMode.IN_BODY;
      this.tokenizer.state = TokenizerMode.PLAINTEXT;
    }
    //Fragment parsing
    _getAdjustedCurrentElement() {
      return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
    }
    _findFormInFragmentContext() {
      let node = this.fragmentContext;
      while (node) {
        if (this.treeAdapter.getTagName(node) === TAG_NAMES.FORM) {
          this.formElement = node;
          break;
        }
        node = this.treeAdapter.getParentNode(node);
      }
    }
    _initTokenizerForFragmentParsing() {
      if (!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== NS.HTML) {
        return;
      }
      switch (this.fragmentContextID) {
        case TAG_ID.TITLE:
        case TAG_ID.TEXTAREA: {
          this.tokenizer.state = TokenizerMode.RCDATA;
          break;
        }
        case TAG_ID.STYLE:
        case TAG_ID.XMP:
        case TAG_ID.IFRAME:
        case TAG_ID.NOEMBED:
        case TAG_ID.NOFRAMES:
        case TAG_ID.NOSCRIPT: {
          this.tokenizer.state = TokenizerMode.RAWTEXT;
          break;
        }
        case TAG_ID.SCRIPT: {
          this.tokenizer.state = TokenizerMode.SCRIPT_DATA;
          break;
        }
        case TAG_ID.PLAINTEXT: {
          this.tokenizer.state = TokenizerMode.PLAINTEXT;
          break;
        }
      }
    }
    //Tree mutation
    _setDocumentType(token) {
      const name2 = token.name || "";
      const publicId = token.publicId || "";
      const systemId = token.systemId || "";
      this.treeAdapter.setDocumentType(this.document, name2, publicId, systemId);
      if (token.location) {
        const documentChildren = this.treeAdapter.getChildNodes(this.document);
        const docTypeNode = documentChildren.find((node) => this.treeAdapter.isDocumentTypeNode(node));
        if (docTypeNode) {
          this.treeAdapter.setNodeSourceCodeLocation(docTypeNode, token.location);
        }
      }
    }
    _attachElementToTree(element, location) {
      if (this.options.sourceCodeLocationInfo) {
        const loc = location && {
          ...location,
          startTag: location
        };
        this.treeAdapter.setNodeSourceCodeLocation(element, loc);
      }
      if (this._shouldFosterParentOnInsertion()) {
        this._fosterParentElement(element);
      } else {
        const parent2 = this.openElements.currentTmplContentOrNode;
        this.treeAdapter.appendChild(parent2, element);
      }
    }
    _appendElement(token, namespaceURI) {
      const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
      this._attachElementToTree(element, token.location);
    }
    _insertElement(token, namespaceURI) {
      const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
      this._attachElementToTree(element, token.location);
      this.openElements.push(element, token.tagID);
    }
    _insertFakeElement(tagName, tagID) {
      const element = this.treeAdapter.createElement(tagName, NS.HTML, []);
      this._attachElementToTree(element, null);
      this.openElements.push(element, tagID);
    }
    _insertTemplate(token) {
      const tmpl = this.treeAdapter.createElement(token.tagName, NS.HTML, token.attrs);
      const content = this.treeAdapter.createDocumentFragment();
      this.treeAdapter.setTemplateContent(tmpl, content);
      this._attachElementToTree(tmpl, token.location);
      this.openElements.push(tmpl, token.tagID);
      if (this.options.sourceCodeLocationInfo)
        this.treeAdapter.setNodeSourceCodeLocation(content, null);
    }
    _insertFakeRootElement() {
      const element = this.treeAdapter.createElement(TAG_NAMES.HTML, NS.HTML, []);
      if (this.options.sourceCodeLocationInfo)
        this.treeAdapter.setNodeSourceCodeLocation(element, null);
      this.treeAdapter.appendChild(this.openElements.current, element);
      this.openElements.push(element, TAG_ID.HTML);
    }
    _appendCommentNode(token, parent2) {
      const commentNode = this.treeAdapter.createCommentNode(token.data);
      this.treeAdapter.appendChild(parent2, commentNode);
      if (this.options.sourceCodeLocationInfo) {
        this.treeAdapter.setNodeSourceCodeLocation(commentNode, token.location);
      }
    }
    _insertCharacters(token) {
      let parent2;
      let beforeElement;
      if (this._shouldFosterParentOnInsertion()) {
        ({ parent: parent2, beforeElement } = this._findFosterParentingLocation());
        if (beforeElement) {
          this.treeAdapter.insertTextBefore(parent2, token.chars, beforeElement);
        } else {
          this.treeAdapter.insertText(parent2, token.chars);
        }
      } else {
        parent2 = this.openElements.currentTmplContentOrNode;
        this.treeAdapter.insertText(parent2, token.chars);
      }
      if (!token.location)
        return;
      const siblings2 = this.treeAdapter.getChildNodes(parent2);
      const textNodeIdx = beforeElement ? siblings2.lastIndexOf(beforeElement) : siblings2.length;
      const textNode = siblings2[textNodeIdx - 1];
      const tnLoc = this.treeAdapter.getNodeSourceCodeLocation(textNode);
      if (tnLoc) {
        const { endLine, endCol, endOffset } = token.location;
        this.treeAdapter.updateNodeSourceCodeLocation(textNode, { endLine, endCol, endOffset });
      } else if (this.options.sourceCodeLocationInfo) {
        this.treeAdapter.setNodeSourceCodeLocation(textNode, token.location);
      }
    }
    _adoptNodes(donor, recipient) {
      for (let child = this.treeAdapter.getFirstChild(donor); child; child = this.treeAdapter.getFirstChild(donor)) {
        this.treeAdapter.detachNode(child);
        this.treeAdapter.appendChild(recipient, child);
      }
    }
    _setEndLocation(element, closingToken) {
      if (this.treeAdapter.getNodeSourceCodeLocation(element) && closingToken.location) {
        const ctLoc = closingToken.location;
        const tn = this.treeAdapter.getTagName(element);
        const endLoc = (
          // NOTE: For cases like <p> <p> </p> - First 'p' closes without a closing
          // tag and for cases like <td> <p> </td> - 'p' closes without a closing tag.
          closingToken.type === TokenType.END_TAG && tn === closingToken.tagName ? {
            endTag: { ...ctLoc },
            endLine: ctLoc.endLine,
            endCol: ctLoc.endCol,
            endOffset: ctLoc.endOffset
          } : {
            endLine: ctLoc.startLine,
            endCol: ctLoc.startCol,
            endOffset: ctLoc.startOffset
          }
        );
        this.treeAdapter.updateNodeSourceCodeLocation(element, endLoc);
      }
    }
    //Token processing
    shouldProcessStartTagTokenInForeignContent(token) {
      if (!this.currentNotInHTML)
        return false;
      let current;
      let currentTagId;
      if (this.openElements.stackTop === 0 && this.fragmentContext) {
        current = this.fragmentContext;
        currentTagId = this.fragmentContextID;
      } else {
        ({ current, currentTagId } = this.openElements);
      }
      if (token.tagID === TAG_ID.SVG && this.treeAdapter.getTagName(current) === TAG_NAMES.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(current) === NS.MATHML) {
        return false;
      }
      return (
        // Check that `current` is not an integration point for HTML or MathML elements.
        this.tokenizer.inForeignNode || // If it _is_ an integration point, then we might have to check that it is not an HTML
        // integration point.
        (token.tagID === TAG_ID.MGLYPH || token.tagID === TAG_ID.MALIGNMARK) && !this._isIntegrationPoint(currentTagId, current, NS.HTML)
      );
    }
    _processToken(token) {
      switch (token.type) {
        case TokenType.CHARACTER: {
          this.onCharacter(token);
          break;
        }
        case TokenType.NULL_CHARACTER: {
          this.onNullCharacter(token);
          break;
        }
        case TokenType.COMMENT: {
          this.onComment(token);
          break;
        }
        case TokenType.DOCTYPE: {
          this.onDoctype(token);
          break;
        }
        case TokenType.START_TAG: {
          this._processStartTag(token);
          break;
        }
        case TokenType.END_TAG: {
          this.onEndTag(token);
          break;
        }
        case TokenType.EOF: {
          this.onEof(token);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          this.onWhitespaceCharacter(token);
          break;
        }
      }
    }
    //Integration points
    _isIntegrationPoint(tid, element, foreignNS) {
      const ns = this.treeAdapter.getNamespaceURI(element);
      const attrs = this.treeAdapter.getAttrList(element);
      return isIntegrationPoint(tid, ns, attrs, foreignNS);
    }
    //Active formatting elements reconstruction
    _reconstructActiveFormattingElements() {
      const listLength = this.activeFormattingElements.entries.length;
      if (listLength) {
        const endIndex = this.activeFormattingElements.entries.findIndex((entry) => entry.type === EntryType.Marker || this.openElements.contains(entry.element));
        const unopenIdx = endIndex < 0 ? listLength - 1 : endIndex - 1;
        for (let i2 = unopenIdx; i2 >= 0; i2--) {
          const entry = this.activeFormattingElements.entries[i2];
          this._insertElement(entry.token, this.treeAdapter.getNamespaceURI(entry.element));
          entry.element = this.openElements.current;
        }
      }
    }
    //Close elements
    _closeTableCell() {
      this.openElements.generateImpliedEndTags();
      this.openElements.popUntilTableCellPopped();
      this.activeFormattingElements.clearToLastMarker();
      this.insertionMode = InsertionMode.IN_ROW;
    }
    _closePElement() {
      this.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.P);
      this.openElements.popUntilTagNamePopped(TAG_ID.P);
    }
    //Insertion modes
    _resetInsertionMode() {
      for (let i2 = this.openElements.stackTop; i2 >= 0; i2--) {
        switch (i2 === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[i2]) {
          case TAG_ID.TR: {
            this.insertionMode = InsertionMode.IN_ROW;
            return;
          }
          case TAG_ID.TBODY:
          case TAG_ID.THEAD:
          case TAG_ID.TFOOT: {
            this.insertionMode = InsertionMode.IN_TABLE_BODY;
            return;
          }
          case TAG_ID.CAPTION: {
            this.insertionMode = InsertionMode.IN_CAPTION;
            return;
          }
          case TAG_ID.COLGROUP: {
            this.insertionMode = InsertionMode.IN_COLUMN_GROUP;
            return;
          }
          case TAG_ID.TABLE: {
            this.insertionMode = InsertionMode.IN_TABLE;
            return;
          }
          case TAG_ID.BODY: {
            this.insertionMode = InsertionMode.IN_BODY;
            return;
          }
          case TAG_ID.FRAMESET: {
            this.insertionMode = InsertionMode.IN_FRAMESET;
            return;
          }
          case TAG_ID.SELECT: {
            this._resetInsertionModeForSelect(i2);
            return;
          }
          case TAG_ID.TEMPLATE: {
            this.insertionMode = this.tmplInsertionModeStack[0];
            return;
          }
          case TAG_ID.HTML: {
            this.insertionMode = this.headElement ? InsertionMode.AFTER_HEAD : InsertionMode.BEFORE_HEAD;
            return;
          }
          case TAG_ID.TD:
          case TAG_ID.TH: {
            if (i2 > 0) {
              this.insertionMode = InsertionMode.IN_CELL;
              return;
            }
            break;
          }
          case TAG_ID.HEAD: {
            if (i2 > 0) {
              this.insertionMode = InsertionMode.IN_HEAD;
              return;
            }
            break;
          }
        }
      }
      this.insertionMode = InsertionMode.IN_BODY;
    }
    _resetInsertionModeForSelect(selectIdx) {
      if (selectIdx > 0) {
        for (let i2 = selectIdx - 1; i2 > 0; i2--) {
          const tn = this.openElements.tagIDs[i2];
          if (tn === TAG_ID.TEMPLATE) {
            break;
          } else if (tn === TAG_ID.TABLE) {
            this.insertionMode = InsertionMode.IN_SELECT_IN_TABLE;
            return;
          }
        }
      }
      this.insertionMode = InsertionMode.IN_SELECT;
    }
    //Foster parenting
    _isElementCausesFosterParenting(tn) {
      return TABLE_STRUCTURE_TAGS.has(tn);
    }
    _shouldFosterParentOnInsertion() {
      return this.fosterParentingEnabled && this._isElementCausesFosterParenting(this.openElements.currentTagId);
    }
    _findFosterParentingLocation() {
      for (let i2 = this.openElements.stackTop; i2 >= 0; i2--) {
        const openElement = this.openElements.items[i2];
        switch (this.openElements.tagIDs[i2]) {
          case TAG_ID.TEMPLATE: {
            if (this.treeAdapter.getNamespaceURI(openElement) === NS.HTML) {
              return { parent: this.treeAdapter.getTemplateContent(openElement), beforeElement: null };
            }
            break;
          }
          case TAG_ID.TABLE: {
            const parent2 = this.treeAdapter.getParentNode(openElement);
            if (parent2) {
              return { parent: parent2, beforeElement: openElement };
            }
            return { parent: this.openElements.items[i2 - 1], beforeElement: null };
          }
        }
      }
      return { parent: this.openElements.items[0], beforeElement: null };
    }
    _fosterParentElement(element) {
      const location = this._findFosterParentingLocation();
      if (location.beforeElement) {
        this.treeAdapter.insertBefore(location.parent, element, location.beforeElement);
      } else {
        this.treeAdapter.appendChild(location.parent, element);
      }
    }
    //Special elements
    _isSpecialElement(element, id) {
      const ns = this.treeAdapter.getNamespaceURI(element);
      return SPECIAL_ELEMENTS[ns].has(id);
    }
    onCharacter(token) {
      this.skipNextNewLine = false;
      if (this.tokenizer.inForeignNode) {
        characterInForeignContent(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_TEMPLATE: {
          characterInBody(this, token);
          break;
        }
        case InsertionMode.TEXT:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          characterInTableText(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          tokenInColumnGroup(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          tokenAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
      }
    }
    onNullCharacter(token) {
      this.skipNextNewLine = false;
      if (this.tokenizer.inForeignNode) {
        nullCharacterInForeignContent(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          tokenInColumnGroup(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          tokenAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
      }
    }
    onComment(token) {
      this.skipNextNewLine = false;
      if (this.currentNotInHTML) {
        appendComment(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL:
        case InsertionMode.BEFORE_HTML:
        case InsertionMode.BEFORE_HEAD:
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD:
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE:
        case InsertionMode.IN_TEMPLATE:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET: {
          appendComment(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          appendCommentToRootHtmlElement(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          appendCommentToDocument(this, token);
          break;
        }
      }
    }
    onDoctype(token) {
      this.skipNextNewLine = false;
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          doctypeInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD:
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD: {
          this._err(token, ERR.misplacedDoctype);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
      }
    }
    onStartTag(token) {
      this.skipNextNewLine = false;
      this.currentToken = token;
      this._processStartTag(token);
      if (token.selfClosing && !token.ackSelfClosing) {
        this._err(token, ERR.nonVoidHtmlElementStartTagWithTrailingSolidus);
      }
    }
    /**
     * Processes a given start tag.
     *
     * `onStartTag` checks if a self-closing tag was recognized. When a token
     * is moved inbetween multiple insertion modes, this check for self-closing
     * could lead to false positives. To avoid this, `_processStartTag` is used
     * for nested calls.
     *
     * @param token The token to process.
     */
    _processStartTag(token) {
      if (this.shouldProcessStartTagTokenInForeignContent(token)) {
        startTagInForeignContent(this, token);
      } else {
        this._startTagOutsideForeignContent(token);
      }
    }
    _startTagOutsideForeignContent(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          startTagBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          startTagBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          startTagInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          startTagInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          startTagAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY: {
          startTagInBody(this, token);
          break;
        }
        case InsertionMode.IN_TABLE: {
          startTagInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_CAPTION: {
          startTagInCaption(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          startTagInColumnGroup(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_BODY: {
          startTagInTableBody(this, token);
          break;
        }
        case InsertionMode.IN_ROW: {
          startTagInRow(this, token);
          break;
        }
        case InsertionMode.IN_CELL: {
          startTagInCell(this, token);
          break;
        }
        case InsertionMode.IN_SELECT: {
          startTagInSelect(this, token);
          break;
        }
        case InsertionMode.IN_SELECT_IN_TABLE: {
          startTagInSelectInTable(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          startTagInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          startTagAfterBody(this, token);
          break;
        }
        case InsertionMode.IN_FRAMESET: {
          startTagInFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_FRAMESET: {
          startTagAfterFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          startTagAfterAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          startTagAfterAfterFrameset(this, token);
          break;
        }
      }
    }
    onEndTag(token) {
      this.skipNextNewLine = false;
      this.currentToken = token;
      if (this.currentNotInHTML) {
        endTagInForeignContent(this, token);
      } else {
        this._endTagOutsideForeignContent(token);
      }
    }
    _endTagOutsideForeignContent(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          endTagBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          endTagBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          endTagInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          endTagInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          endTagAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY: {
          endTagInBody(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          endTagInText(this, token);
          break;
        }
        case InsertionMode.IN_TABLE: {
          endTagInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_CAPTION: {
          endTagInCaption(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          endTagInColumnGroup(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_BODY: {
          endTagInTableBody(this, token);
          break;
        }
        case InsertionMode.IN_ROW: {
          endTagInRow(this, token);
          break;
        }
        case InsertionMode.IN_CELL: {
          endTagInCell(this, token);
          break;
        }
        case InsertionMode.IN_SELECT: {
          endTagInSelect(this, token);
          break;
        }
        case InsertionMode.IN_SELECT_IN_TABLE: {
          endTagInSelectInTable(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          endTagInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          endTagAfterBody(this, token);
          break;
        }
        case InsertionMode.IN_FRAMESET: {
          endTagInFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_FRAMESET: {
          endTagAfterFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
      }
    }
    onEof(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE: {
          eofInBody(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          eofInText(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          eofInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET:
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          stopParsing(this, token);
          break;
        }
      }
    }
    onWhitespaceCharacter(token) {
      if (this.skipNextNewLine) {
        this.skipNextNewLine = false;
        if (token.chars.charCodeAt(0) === CODE_POINTS.LINE_FEED) {
          if (token.chars.length === 1) {
            return;
          }
          token.chars = token.chars.substr(1);
        }
      }
      if (this.tokenizer.inForeignNode) {
        this._insertCharacters(token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD:
        case InsertionMode.TEXT:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_TEMPLATE:
        case InsertionMode.AFTER_BODY:
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          whitespaceCharacterInBody(this, token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          whitespaceCharacterInTableText(this, token);
          break;
        }
      }
    }
  };
  function aaObtainFormattingElementEntry(p, token) {
    let formattingElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(token.tagName);
    if (formattingElementEntry) {
      if (!p.openElements.contains(formattingElementEntry.element)) {
        p.activeFormattingElements.removeEntry(formattingElementEntry);
        formattingElementEntry = null;
      } else if (!p.openElements.hasInScope(token.tagID)) {
        formattingElementEntry = null;
      }
    } else {
      genericEndTagInBody(p, token);
    }
    return formattingElementEntry;
  }
  function aaObtainFurthestBlock(p, formattingElementEntry) {
    let furthestBlock = null;
    let idx = p.openElements.stackTop;
    for (; idx >= 0; idx--) {
      const element = p.openElements.items[idx];
      if (element === formattingElementEntry.element) {
        break;
      }
      if (p._isSpecialElement(element, p.openElements.tagIDs[idx])) {
        furthestBlock = element;
      }
    }
    if (!furthestBlock) {
      p.openElements.shortenToLength(idx < 0 ? 0 : idx);
      p.activeFormattingElements.removeEntry(formattingElementEntry);
    }
    return furthestBlock;
  }
  function aaInnerLoop(p, furthestBlock, formattingElement) {
    let lastElement = furthestBlock;
    let nextElement = p.openElements.getCommonAncestor(furthestBlock);
    for (let i2 = 0, element = nextElement; element !== formattingElement; i2++, element = nextElement) {
      nextElement = p.openElements.getCommonAncestor(element);
      const elementEntry = p.activeFormattingElements.getElementEntry(element);
      const counterOverflow = elementEntry && i2 >= AA_INNER_LOOP_ITER;
      const shouldRemoveFromOpenElements = !elementEntry || counterOverflow;
      if (shouldRemoveFromOpenElements) {
        if (counterOverflow) {
          p.activeFormattingElements.removeEntry(elementEntry);
        }
        p.openElements.remove(element);
      } else {
        element = aaRecreateElementFromEntry(p, elementEntry);
        if (lastElement === furthestBlock) {
          p.activeFormattingElements.bookmark = elementEntry;
        }
        p.treeAdapter.detachNode(lastElement);
        p.treeAdapter.appendChild(element, lastElement);
        lastElement = element;
      }
    }
    return lastElement;
  }
  function aaRecreateElementFromEntry(p, elementEntry) {
    const ns = p.treeAdapter.getNamespaceURI(elementEntry.element);
    const newElement = p.treeAdapter.createElement(elementEntry.token.tagName, ns, elementEntry.token.attrs);
    p.openElements.replace(elementEntry.element, newElement);
    elementEntry.element = newElement;
    return newElement;
  }
  function aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement) {
    const tn = p.treeAdapter.getTagName(commonAncestor);
    const tid = getTagID(tn);
    if (p._isElementCausesFosterParenting(tid)) {
      p._fosterParentElement(lastElement);
    } else {
      const ns = p.treeAdapter.getNamespaceURI(commonAncestor);
      if (tid === TAG_ID.TEMPLATE && ns === NS.HTML) {
        commonAncestor = p.treeAdapter.getTemplateContent(commonAncestor);
      }
      p.treeAdapter.appendChild(commonAncestor, lastElement);
    }
  }
  function aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry) {
    const ns = p.treeAdapter.getNamespaceURI(formattingElementEntry.element);
    const { token } = formattingElementEntry;
    const newElement = p.treeAdapter.createElement(token.tagName, ns, token.attrs);
    p._adoptNodes(furthestBlock, newElement);
    p.treeAdapter.appendChild(furthestBlock, newElement);
    p.activeFormattingElements.insertElementAfterBookmark(newElement, token);
    p.activeFormattingElements.removeEntry(formattingElementEntry);
    p.openElements.remove(formattingElementEntry.element);
    p.openElements.insertAfter(furthestBlock, newElement, token.tagID);
  }
  function callAdoptionAgency(p, token) {
    for (let i2 = 0; i2 < AA_OUTER_LOOP_ITER; i2++) {
      const formattingElementEntry = aaObtainFormattingElementEntry(p, token);
      if (!formattingElementEntry) {
        break;
      }
      const furthestBlock = aaObtainFurthestBlock(p, formattingElementEntry);
      if (!furthestBlock) {
        break;
      }
      p.activeFormattingElements.bookmark = formattingElementEntry;
      const lastElement = aaInnerLoop(p, furthestBlock, formattingElementEntry.element);
      const commonAncestor = p.openElements.getCommonAncestor(formattingElementEntry.element);
      p.treeAdapter.detachNode(lastElement);
      if (commonAncestor)
        aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement);
      aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry);
    }
  }
  function appendComment(p, token) {
    p._appendCommentNode(token, p.openElements.currentTmplContentOrNode);
  }
  function appendCommentToRootHtmlElement(p, token) {
    p._appendCommentNode(token, p.openElements.items[0]);
  }
  function appendCommentToDocument(p, token) {
    p._appendCommentNode(token, p.document);
  }
  function stopParsing(p, token) {
    p.stopped = true;
    if (token.location) {
      const target = p.fragmentContext ? 0 : 2;
      for (let i2 = p.openElements.stackTop; i2 >= target; i2--) {
        p._setEndLocation(p.openElements.items[i2], token);
      }
      if (!p.fragmentContext && p.openElements.stackTop >= 0) {
        const htmlElement = p.openElements.items[0];
        const htmlLocation = p.treeAdapter.getNodeSourceCodeLocation(htmlElement);
        if (htmlLocation && !htmlLocation.endTag) {
          p._setEndLocation(htmlElement, token);
          if (p.openElements.stackTop >= 1) {
            const bodyElement = p.openElements.items[1];
            const bodyLocation = p.treeAdapter.getNodeSourceCodeLocation(bodyElement);
            if (bodyLocation && !bodyLocation.endTag) {
              p._setEndLocation(bodyElement, token);
            }
          }
        }
      }
    }
  }
  function doctypeInInitialMode(p, token) {
    p._setDocumentType(token);
    const mode = token.forceQuirks ? DOCUMENT_MODE.QUIRKS : getDocumentMode(token);
    if (!isConforming(token)) {
      p._err(token, ERR.nonConformingDoctype);
    }
    p.treeAdapter.setDocumentMode(p.document, mode);
    p.insertionMode = InsertionMode.BEFORE_HTML;
  }
  function tokenInInitialMode(p, token) {
    p._err(token, ERR.missingDoctype, true);
    p.treeAdapter.setDocumentMode(p.document, DOCUMENT_MODE.QUIRKS);
    p.insertionMode = InsertionMode.BEFORE_HTML;
    p._processToken(token);
  }
  function startTagBeforeHtml(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.BEFORE_HEAD;
    } else {
      tokenBeforeHtml(p, token);
    }
  }
  function endTagBeforeHtml(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.HTML || tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.BR) {
      tokenBeforeHtml(p, token);
    }
  }
  function tokenBeforeHtml(p, token) {
    p._insertFakeRootElement();
    p.insertionMode = InsertionMode.BEFORE_HEAD;
    p._processToken(token);
  }
  function startTagBeforeHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.HEAD: {
        p._insertElement(token, NS.HTML);
        p.headElement = p.openElements.current;
        p.insertionMode = InsertionMode.IN_HEAD;
        break;
      }
      default: {
        tokenBeforeHead(p, token);
      }
    }
  }
  function endTagBeforeHead(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.HTML || tn === TAG_ID.BR) {
      tokenBeforeHead(p, token);
    } else {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
  function tokenBeforeHead(p, token) {
    p._insertFakeElement(TAG_NAMES.HEAD, TAG_ID.HEAD);
    p.headElement = p.openElements.current;
    p.insertionMode = InsertionMode.IN_HEAD;
    p._processToken(token);
  }
  function startTagInHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.TITLE: {
        p._switchToTextParsing(token, TokenizerMode.RCDATA);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        if (p.options.scriptingEnabled) {
          p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
        } else {
          p._insertElement(token, NS.HTML);
          p.insertionMode = InsertionMode.IN_HEAD_NO_SCRIPT;
        }
        break;
      }
      case TAG_ID.NOFRAMES:
      case TAG_ID.STYLE: {
        p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
        break;
      }
      case TAG_ID.SCRIPT: {
        p._switchToTextParsing(token, TokenizerMode.SCRIPT_DATA);
        break;
      }
      case TAG_ID.TEMPLATE: {
        p._insertTemplate(token);
        p.activeFormattingElements.insertMarker();
        p.framesetOk = false;
        p.insertionMode = InsertionMode.IN_TEMPLATE;
        p.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
        break;
      }
      case TAG_ID.HEAD: {
        p._err(token, ERR.misplacedStartTagForHeadElement);
        break;
      }
      default: {
        tokenInHead(p, token);
      }
    }
  }
  function endTagInHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HEAD: {
        p.openElements.pop();
        p.insertionMode = InsertionMode.AFTER_HEAD;
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.BR:
      case TAG_ID.HTML: {
        tokenInHead(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function templateEndTagInHead(p, token) {
    if (p.openElements.tmplCount > 0) {
      p.openElements.generateImpliedEndTagsThoroughly();
      if (p.openElements.currentTagId !== TAG_ID.TEMPLATE) {
        p._err(token, ERR.closingOfElementWithOpenChildElements);
      }
      p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
      p.activeFormattingElements.clearToLastMarker();
      p.tmplInsertionModeStack.shift();
      p._resetInsertionMode();
    } else {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
  function tokenInHead(p, token) {
    p.openElements.pop();
    p.insertionMode = InsertionMode.AFTER_HEAD;
    p._processToken(token);
  }
  function startTagInHeadNoScript(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.HEAD:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.STYLE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        p._err(token, ERR.nestedNoscriptInHead);
        break;
      }
      default: {
        tokenInHeadNoScript(p, token);
      }
    }
  }
  function endTagInHeadNoScript(p, token) {
    switch (token.tagID) {
      case TAG_ID.NOSCRIPT: {
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_HEAD;
        break;
      }
      case TAG_ID.BR: {
        tokenInHeadNoScript(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function tokenInHeadNoScript(p, token) {
    const errCode = token.type === TokenType.EOF ? ERR.openElementsLeftAfterEof : ERR.disallowedContentInNoscriptInHead;
    p._err(token, errCode);
    p.openElements.pop();
    p.insertionMode = InsertionMode.IN_HEAD;
    p._processToken(token);
  }
  function startTagAfterHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BODY: {
        p._insertElement(token, NS.HTML);
        p.framesetOk = false;
        p.insertionMode = InsertionMode.IN_BODY;
        break;
      }
      case TAG_ID.FRAMESET: {
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_FRAMESET;
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.SCRIPT:
      case TAG_ID.STYLE:
      case TAG_ID.TEMPLATE:
      case TAG_ID.TITLE: {
        p._err(token, ERR.abandonedHeadElementChild);
        p.openElements.push(p.headElement, TAG_ID.HEAD);
        startTagInHead(p, token);
        p.openElements.remove(p.headElement);
        break;
      }
      case TAG_ID.HEAD: {
        p._err(token, ERR.misplacedStartTagForHeadElement);
        break;
      }
      default: {
        tokenAfterHead(p, token);
      }
    }
  }
  function endTagAfterHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.BODY:
      case TAG_ID.HTML:
      case TAG_ID.BR: {
        tokenAfterHead(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function tokenAfterHead(p, token) {
    p._insertFakeElement(TAG_NAMES.BODY, TAG_ID.BODY);
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function modeInBody(p, token) {
    switch (token.type) {
      case TokenType.CHARACTER: {
        characterInBody(p, token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        whitespaceCharacterInBody(p, token);
        break;
      }
      case TokenType.COMMENT: {
        appendComment(p, token);
        break;
      }
      case TokenType.START_TAG: {
        startTagInBody(p, token);
        break;
      }
      case TokenType.END_TAG: {
        endTagInBody(p, token);
        break;
      }
      case TokenType.EOF: {
        eofInBody(p, token);
        break;
      }
    }
  }
  function whitespaceCharacterInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertCharacters(token);
  }
  function characterInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertCharacters(token);
    p.framesetOk = false;
  }
  function htmlStartTagInBody(p, token) {
    if (p.openElements.tmplCount === 0) {
      p.treeAdapter.adoptAttributes(p.openElements.items[0], token.attrs);
    }
  }
  function bodyStartTagInBody(p, token) {
    const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
    if (bodyElement && p.openElements.tmplCount === 0) {
      p.framesetOk = false;
      p.treeAdapter.adoptAttributes(bodyElement, token.attrs);
    }
  }
  function framesetStartTagInBody(p, token) {
    const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
    if (p.framesetOk && bodyElement) {
      p.treeAdapter.detachNode(bodyElement);
      p.openElements.popAllUpToHtmlElement();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_FRAMESET;
    }
  }
  function addressStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
  }
  function numberedHeaderStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    if (isNumberedHeader(p.openElements.currentTagId)) {
      p.openElements.pop();
    }
    p._insertElement(token, NS.HTML);
  }
  function preStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.skipNextNewLine = true;
    p.framesetOk = false;
  }
  function formStartTagInBody(p, token) {
    const inTemplate = p.openElements.tmplCount > 0;
    if (!p.formElement || inTemplate) {
      if (p.openElements.hasInButtonScope(TAG_ID.P)) {
        p._closePElement();
      }
      p._insertElement(token, NS.HTML);
      if (!inTemplate) {
        p.formElement = p.openElements.current;
      }
    }
  }
  function listItemStartTagInBody(p, token) {
    p.framesetOk = false;
    const tn = token.tagID;
    for (let i2 = p.openElements.stackTop; i2 >= 0; i2--) {
      const elementId = p.openElements.tagIDs[i2];
      if (tn === TAG_ID.LI && elementId === TAG_ID.LI || (tn === TAG_ID.DD || tn === TAG_ID.DT) && (elementId === TAG_ID.DD || elementId === TAG_ID.DT)) {
        p.openElements.generateImpliedEndTagsWithExclusion(elementId);
        p.openElements.popUntilTagNamePopped(elementId);
        break;
      }
      if (elementId !== TAG_ID.ADDRESS && elementId !== TAG_ID.DIV && elementId !== TAG_ID.P && p._isSpecialElement(p.openElements.items[i2], elementId)) {
        break;
      }
    }
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
  }
  function plaintextStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.tokenizer.state = TokenizerMode.PLAINTEXT;
  }
  function buttonStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BUTTON)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(TAG_ID.BUTTON);
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
  }
  function aStartTagInBody(p, token) {
    const activeElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(TAG_NAMES.A);
    if (activeElementEntry) {
      callAdoptionAgency(p, token);
      p.openElements.remove(activeElementEntry.element);
      p.activeFormattingElements.removeEntry(activeElementEntry);
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function bStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function nobrStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    if (p.openElements.hasInScope(TAG_ID.NOBR)) {
      callAdoptionAgency(p, token);
      p._reconstructActiveFormattingElements();
    }
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function appletStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.insertMarker();
    p.framesetOk = false;
  }
  function tableStartTagInBody(p, token) {
    if (p.treeAdapter.getDocumentMode(p.document) !== DOCUMENT_MODE.QUIRKS && p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
    p.insertionMode = InsertionMode.IN_TABLE;
  }
  function areaStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElement(token, NS.HTML);
    p.framesetOk = false;
    token.ackSelfClosing = true;
  }
  function isHiddenInput(token) {
    const inputType = getTokenAttr(token, ATTRS.TYPE);
    return inputType != null && inputType.toLowerCase() === HIDDEN_INPUT_TYPE;
  }
  function inputStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElement(token, NS.HTML);
    if (!isHiddenInput(token)) {
      p.framesetOk = false;
    }
    token.ackSelfClosing = true;
  }
  function paramStartTagInBody(p, token) {
    p._appendElement(token, NS.HTML);
    token.ackSelfClosing = true;
  }
  function hrStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._appendElement(token, NS.HTML);
    p.framesetOk = false;
    token.ackSelfClosing = true;
  }
  function imageStartTagInBody(p, token) {
    token.tagName = TAG_NAMES.IMG;
    token.tagID = TAG_ID.IMG;
    areaStartTagInBody(p, token);
  }
  function textareaStartTagInBody(p, token) {
    p._insertElement(token, NS.HTML);
    p.skipNextNewLine = true;
    p.tokenizer.state = TokenizerMode.RCDATA;
    p.originalInsertionMode = p.insertionMode;
    p.framesetOk = false;
    p.insertionMode = InsertionMode.TEXT;
  }
  function xmpStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._reconstructActiveFormattingElements();
    p.framesetOk = false;
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function iframeStartTagInBody(p, token) {
    p.framesetOk = false;
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function noembedStartTagInBody(p, token) {
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function selectStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
    p.insertionMode = p.insertionMode === InsertionMode.IN_TABLE || p.insertionMode === InsertionMode.IN_CAPTION || p.insertionMode === InsertionMode.IN_TABLE_BODY || p.insertionMode === InsertionMode.IN_ROW || p.insertionMode === InsertionMode.IN_CELL ? InsertionMode.IN_SELECT_IN_TABLE : InsertionMode.IN_SELECT;
  }
  function optgroupStartTagInBody(p, token) {
    if (p.openElements.currentTagId === TAG_ID.OPTION) {
      p.openElements.pop();
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
  }
  function rbStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.RUBY)) {
      p.openElements.generateImpliedEndTags();
    }
    p._insertElement(token, NS.HTML);
  }
  function rtStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.RUBY)) {
      p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.RTC);
    }
    p._insertElement(token, NS.HTML);
  }
  function mathStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    adjustTokenMathMLAttrs(token);
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, NS.MATHML);
    } else {
      p._insertElement(token, NS.MATHML);
    }
    token.ackSelfClosing = true;
  }
  function svgStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    adjustTokenSVGAttrs(token);
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, NS.SVG);
    } else {
      p._insertElement(token, NS.SVG);
    }
    token.ackSelfClosing = true;
  }
  function genericStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
  }
  function startTagInBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.I:
      case TAG_ID.S:
      case TAG_ID.B:
      case TAG_ID.U:
      case TAG_ID.EM:
      case TAG_ID.TT:
      case TAG_ID.BIG:
      case TAG_ID.CODE:
      case TAG_ID.FONT:
      case TAG_ID.SMALL:
      case TAG_ID.STRIKE:
      case TAG_ID.STRONG: {
        bStartTagInBody(p, token);
        break;
      }
      case TAG_ID.A: {
        aStartTagInBody(p, token);
        break;
      }
      case TAG_ID.H1:
      case TAG_ID.H2:
      case TAG_ID.H3:
      case TAG_ID.H4:
      case TAG_ID.H5:
      case TAG_ID.H6: {
        numberedHeaderStartTagInBody(p, token);
        break;
      }
      case TAG_ID.P:
      case TAG_ID.DL:
      case TAG_ID.OL:
      case TAG_ID.UL:
      case TAG_ID.DIV:
      case TAG_ID.DIR:
      case TAG_ID.NAV:
      case TAG_ID.MAIN:
      case TAG_ID.MENU:
      case TAG_ID.ASIDE:
      case TAG_ID.CENTER:
      case TAG_ID.FIGURE:
      case TAG_ID.FOOTER:
      case TAG_ID.HEADER:
      case TAG_ID.HGROUP:
      case TAG_ID.DIALOG:
      case TAG_ID.DETAILS:
      case TAG_ID.ADDRESS:
      case TAG_ID.ARTICLE:
      case TAG_ID.SECTION:
      case TAG_ID.SUMMARY:
      case TAG_ID.FIELDSET:
      case TAG_ID.BLOCKQUOTE:
      case TAG_ID.FIGCAPTION: {
        addressStartTagInBody(p, token);
        break;
      }
      case TAG_ID.LI:
      case TAG_ID.DD:
      case TAG_ID.DT: {
        listItemStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BR:
      case TAG_ID.IMG:
      case TAG_ID.WBR:
      case TAG_ID.AREA:
      case TAG_ID.EMBED:
      case TAG_ID.KEYGEN: {
        areaStartTagInBody(p, token);
        break;
      }
      case TAG_ID.HR: {
        hrStartTagInBody(p, token);
        break;
      }
      case TAG_ID.RB:
      case TAG_ID.RTC: {
        rbStartTagInBody(p, token);
        break;
      }
      case TAG_ID.RT:
      case TAG_ID.RP: {
        rtStartTagInBody(p, token);
        break;
      }
      case TAG_ID.PRE:
      case TAG_ID.LISTING: {
        preStartTagInBody(p, token);
        break;
      }
      case TAG_ID.XMP: {
        xmpStartTagInBody(p, token);
        break;
      }
      case TAG_ID.SVG: {
        svgStartTagInBody(p, token);
        break;
      }
      case TAG_ID.HTML: {
        htmlStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.STYLE:
      case TAG_ID.TITLE:
      case TAG_ID.SCRIPT:
      case TAG_ID.BGSOUND:
      case TAG_ID.BASEFONT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.BODY: {
        bodyStartTagInBody(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOBR: {
        nobrStartTagInBody(p, token);
        break;
      }
      case TAG_ID.MATH: {
        mathStartTagInBody(p, token);
        break;
      }
      case TAG_ID.TABLE: {
        tableStartTagInBody(p, token);
        break;
      }
      case TAG_ID.INPUT: {
        inputStartTagInBody(p, token);
        break;
      }
      case TAG_ID.PARAM:
      case TAG_ID.TRACK:
      case TAG_ID.SOURCE: {
        paramStartTagInBody(p, token);
        break;
      }
      case TAG_ID.IMAGE: {
        imageStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BUTTON: {
        buttonStartTagInBody(p, token);
        break;
      }
      case TAG_ID.APPLET:
      case TAG_ID.OBJECT:
      case TAG_ID.MARQUEE: {
        appletStartTagInBody(p, token);
        break;
      }
      case TAG_ID.IFRAME: {
        iframeStartTagInBody(p, token);
        break;
      }
      case TAG_ID.SELECT: {
        selectStartTagInBody(p, token);
        break;
      }
      case TAG_ID.OPTION:
      case TAG_ID.OPTGROUP: {
        optgroupStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOEMBED: {
        noembedStartTagInBody(p, token);
        break;
      }
      case TAG_ID.FRAMESET: {
        framesetStartTagInBody(p, token);
        break;
      }
      case TAG_ID.TEXTAREA: {
        textareaStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        if (p.options.scriptingEnabled) {
          noembedStartTagInBody(p, token);
        } else {
          genericStartTagInBody(p, token);
        }
        break;
      }
      case TAG_ID.PLAINTEXT: {
        plaintextStartTagInBody(p, token);
        break;
      }
      case TAG_ID.COL:
      case TAG_ID.TH:
      case TAG_ID.TD:
      case TAG_ID.TR:
      case TAG_ID.HEAD:
      case TAG_ID.FRAME:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.CAPTION:
      case TAG_ID.COLGROUP: {
        break;
      }
      default: {
        genericStartTagInBody(p, token);
      }
    }
  }
  function bodyEndTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BODY)) {
      p.insertionMode = InsertionMode.AFTER_BODY;
      if (p.options.sourceCodeLocationInfo) {
        const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
        if (bodyElement) {
          p._setEndLocation(bodyElement, token);
        }
      }
    }
  }
  function htmlEndTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BODY)) {
      p.insertionMode = InsertionMode.AFTER_BODY;
      endTagAfterBody(p, token);
    }
  }
  function addressEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(tn);
    }
  }
  function formEndTagInBody(p) {
    const inTemplate = p.openElements.tmplCount > 0;
    const { formElement } = p;
    if (!inTemplate) {
      p.formElement = null;
    }
    if ((formElement || inTemplate) && p.openElements.hasInScope(TAG_ID.FORM)) {
      p.openElements.generateImpliedEndTags();
      if (inTemplate) {
        p.openElements.popUntilTagNamePopped(TAG_ID.FORM);
      } else if (formElement) {
        p.openElements.remove(formElement);
      }
    }
  }
  function pEndTagInBody(p) {
    if (!p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._insertFakeElement(TAG_NAMES.P, TAG_ID.P);
    }
    p._closePElement();
  }
  function liEndTagInBody(p) {
    if (p.openElements.hasInListItemScope(TAG_ID.LI)) {
      p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.LI);
      p.openElements.popUntilTagNamePopped(TAG_ID.LI);
    }
  }
  function ddEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTagsWithExclusion(tn);
      p.openElements.popUntilTagNamePopped(tn);
    }
  }
  function numberedHeaderEndTagInBody(p) {
    if (p.openElements.hasNumberedHeaderInScope()) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilNumberedHeaderPopped();
    }
  }
  function appletEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(tn);
      p.activeFormattingElements.clearToLastMarker();
    }
  }
  function brEndTagInBody(p) {
    p._reconstructActiveFormattingElements();
    p._insertFakeElement(TAG_NAMES.BR, TAG_ID.BR);
    p.openElements.pop();
    p.framesetOk = false;
  }
  function genericEndTagInBody(p, token) {
    const tn = token.tagName;
    const tid = token.tagID;
    for (let i2 = p.openElements.stackTop; i2 > 0; i2--) {
      const element = p.openElements.items[i2];
      const elementId = p.openElements.tagIDs[i2];
      if (tid === elementId && (tid !== TAG_ID.UNKNOWN || p.treeAdapter.getTagName(element) === tn)) {
        p.openElements.generateImpliedEndTagsWithExclusion(tid);
        if (p.openElements.stackTop >= i2)
          p.openElements.shortenToLength(i2);
        break;
      }
      if (p._isSpecialElement(element, elementId)) {
        break;
      }
    }
  }
  function endTagInBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.A:
      case TAG_ID.B:
      case TAG_ID.I:
      case TAG_ID.S:
      case TAG_ID.U:
      case TAG_ID.EM:
      case TAG_ID.TT:
      case TAG_ID.BIG:
      case TAG_ID.CODE:
      case TAG_ID.FONT:
      case TAG_ID.NOBR:
      case TAG_ID.SMALL:
      case TAG_ID.STRIKE:
      case TAG_ID.STRONG: {
        callAdoptionAgency(p, token);
        break;
      }
      case TAG_ID.P: {
        pEndTagInBody(p);
        break;
      }
      case TAG_ID.DL:
      case TAG_ID.UL:
      case TAG_ID.OL:
      case TAG_ID.DIR:
      case TAG_ID.DIV:
      case TAG_ID.NAV:
      case TAG_ID.PRE:
      case TAG_ID.MAIN:
      case TAG_ID.MENU:
      case TAG_ID.ASIDE:
      case TAG_ID.BUTTON:
      case TAG_ID.CENTER:
      case TAG_ID.FIGURE:
      case TAG_ID.FOOTER:
      case TAG_ID.HEADER:
      case TAG_ID.HGROUP:
      case TAG_ID.DIALOG:
      case TAG_ID.ADDRESS:
      case TAG_ID.ARTICLE:
      case TAG_ID.DETAILS:
      case TAG_ID.SECTION:
      case TAG_ID.SUMMARY:
      case TAG_ID.LISTING:
      case TAG_ID.FIELDSET:
      case TAG_ID.BLOCKQUOTE:
      case TAG_ID.FIGCAPTION: {
        addressEndTagInBody(p, token);
        break;
      }
      case TAG_ID.LI: {
        liEndTagInBody(p);
        break;
      }
      case TAG_ID.DD:
      case TAG_ID.DT: {
        ddEndTagInBody(p, token);
        break;
      }
      case TAG_ID.H1:
      case TAG_ID.H2:
      case TAG_ID.H3:
      case TAG_ID.H4:
      case TAG_ID.H5:
      case TAG_ID.H6: {
        numberedHeaderEndTagInBody(p);
        break;
      }
      case TAG_ID.BR: {
        brEndTagInBody(p);
        break;
      }
      case TAG_ID.BODY: {
        bodyEndTagInBody(p, token);
        break;
      }
      case TAG_ID.HTML: {
        htmlEndTagInBody(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formEndTagInBody(p);
        break;
      }
      case TAG_ID.APPLET:
      case TAG_ID.OBJECT:
      case TAG_ID.MARQUEE: {
        appletEndTagInBody(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        genericEndTagInBody(p, token);
      }
    }
  }
  function eofInBody(p, token) {
    if (p.tmplInsertionModeStack.length > 0) {
      eofInTemplate(p, token);
    } else {
      stopParsing(p, token);
    }
  }
  function endTagInText(p, token) {
    var _a2;
    if (token.tagID === TAG_ID.SCRIPT) {
      (_a2 = p.scriptHandler) === null || _a2 === void 0 ? void 0 : _a2.call(p, p.openElements.current);
    }
    p.openElements.pop();
    p.insertionMode = p.originalInsertionMode;
  }
  function eofInText(p, token) {
    p._err(token, ERR.eofInElementThatCanContainOnlyText);
    p.openElements.pop();
    p.insertionMode = p.originalInsertionMode;
    p.onEof(token);
  }
  function characterInTable(p, token) {
    if (TABLE_STRUCTURE_TAGS.has(p.openElements.currentTagId)) {
      p.pendingCharacterTokens.length = 0;
      p.hasNonWhitespacePendingCharacterToken = false;
      p.originalInsertionMode = p.insertionMode;
      p.insertionMode = InsertionMode.IN_TABLE_TEXT;
      switch (token.type) {
        case TokenType.CHARACTER: {
          characterInTableText(p, token);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          whitespaceCharacterInTableText(p, token);
          break;
        }
      }
    } else {
      tokenInTable(p, token);
    }
  }
  function captionStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p.activeFormattingElements.insertMarker();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_CAPTION;
  }
  function colgroupStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
  }
  function colStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertFakeElement(TAG_NAMES.COLGROUP, TAG_ID.COLGROUP);
    p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
    startTagInColumnGroup(p, token);
  }
  function tbodyStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_TABLE_BODY;
  }
  function tdStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertFakeElement(TAG_NAMES.TBODY, TAG_ID.TBODY);
    p.insertionMode = InsertionMode.IN_TABLE_BODY;
    startTagInTableBody(p, token);
  }
  function tableStartTagInTable(p, token) {
    if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
      p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
      p._resetInsertionMode();
      p._processStartTag(token);
    }
  }
  function inputStartTagInTable(p, token) {
    if (isHiddenInput(token)) {
      p._appendElement(token, NS.HTML);
    } else {
      tokenInTable(p, token);
    }
    token.ackSelfClosing = true;
  }
  function formStartTagInTable(p, token) {
    if (!p.formElement && p.openElements.tmplCount === 0) {
      p._insertElement(token, NS.HTML);
      p.formElement = p.openElements.current;
      p.openElements.pop();
    }
  }
  function startTagInTable(p, token) {
    switch (token.tagID) {
      case TAG_ID.TD:
      case TAG_ID.TH:
      case TAG_ID.TR: {
        tdStartTagInTable(p, token);
        break;
      }
      case TAG_ID.STYLE:
      case TAG_ID.SCRIPT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.COL: {
        colStartTagInTable(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formStartTagInTable(p, token);
        break;
      }
      case TAG_ID.TABLE: {
        tableStartTagInTable(p, token);
        break;
      }
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        tbodyStartTagInTable(p, token);
        break;
      }
      case TAG_ID.INPUT: {
        inputStartTagInTable(p, token);
        break;
      }
      case TAG_ID.CAPTION: {
        captionStartTagInTable(p, token);
        break;
      }
      case TAG_ID.COLGROUP: {
        colgroupStartTagInTable(p, token);
        break;
      }
      default: {
        tokenInTable(p, token);
      }
    }
  }
  function endTagInTable(p, token) {
    switch (token.tagID) {
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
          p._resetInsertionMode();
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TBODY:
      case TAG_ID.TD:
      case TAG_ID.TFOOT:
      case TAG_ID.TH:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        break;
      }
      default: {
        tokenInTable(p, token);
      }
    }
  }
  function tokenInTable(p, token) {
    const savedFosterParentingState = p.fosterParentingEnabled;
    p.fosterParentingEnabled = true;
    modeInBody(p, token);
    p.fosterParentingEnabled = savedFosterParentingState;
  }
  function whitespaceCharacterInTableText(p, token) {
    p.pendingCharacterTokens.push(token);
  }
  function characterInTableText(p, token) {
    p.pendingCharacterTokens.push(token);
    p.hasNonWhitespacePendingCharacterToken = true;
  }
  function tokenInTableText(p, token) {
    let i2 = 0;
    if (p.hasNonWhitespacePendingCharacterToken) {
      for (; i2 < p.pendingCharacterTokens.length; i2++) {
        tokenInTable(p, p.pendingCharacterTokens[i2]);
      }
    } else {
      for (; i2 < p.pendingCharacterTokens.length; i2++) {
        p._insertCharacters(p.pendingCharacterTokens[i2]);
      }
    }
    p.insertionMode = p.originalInsertionMode;
    p._processToken(token);
  }
  const TABLE_VOID_ELEMENTS = /* @__PURE__ */ new Set([TAG_ID.CAPTION, TAG_ID.COL, TAG_ID.COLGROUP, TAG_ID.TBODY, TAG_ID.TD, TAG_ID.TFOOT, TAG_ID.TH, TAG_ID.THEAD, TAG_ID.TR]);
  function startTagInCaption(p, token) {
    const tn = token.tagID;
    if (TABLE_VOID_ELEMENTS.has(tn)) {
      if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
      }
    } else {
      startTagInBody(p, token);
    }
  }
  function endTagInCaption(p, token) {
    const tn = token.tagID;
    switch (tn) {
      case TAG_ID.CAPTION:
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
          p.openElements.generateImpliedEndTags();
          p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
          p.activeFormattingElements.clearToLastMarker();
          p.insertionMode = InsertionMode.IN_TABLE;
          if (tn === TAG_ID.TABLE) {
            endTagInTable(p, token);
          }
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TBODY:
      case TAG_ID.TD:
      case TAG_ID.TFOOT:
      case TAG_ID.TH:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        break;
      }
      default: {
        endTagInBody(p, token);
      }
    }
  }
  function startTagInColumnGroup(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.COL: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      default: {
        tokenInColumnGroup(p, token);
      }
    }
  }
  function endTagInColumnGroup(p, token) {
    switch (token.tagID) {
      case TAG_ID.COLGROUP: {
        if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      case TAG_ID.COL: {
        break;
      }
      default: {
        tokenInColumnGroup(p, token);
      }
    }
  }
  function tokenInColumnGroup(p, token) {
    if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
      p.openElements.pop();
      p.insertionMode = InsertionMode.IN_TABLE;
      p._processToken(token);
    }
  }
  function startTagInTableBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.TR: {
        p.openElements.clearBackToTableBodyContext();
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_ROW;
        break;
      }
      case TAG_ID.TH:
      case TAG_ID.TD: {
        p.openElements.clearBackToTableBodyContext();
        p._insertFakeElement(TAG_NAMES.TR, TAG_ID.TR);
        p.insertionMode = InsertionMode.IN_ROW;
        startTagInRow(p, token);
        break;
      }
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasTableBodyContextInTableScope()) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
          startTagInTable(p, token);
        }
        break;
      }
      default: {
        startTagInTable(p, token);
      }
    }
  }
  function endTagInTableBody(p, token) {
    const tn = token.tagID;
    switch (token.tagID) {
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasInTableScope(tn)) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
        }
        break;
      }
      case TAG_ID.TABLE: {
        if (p.openElements.hasTableBodyContextInTableScope()) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
          endTagInTable(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TD:
      case TAG_ID.TH:
      case TAG_ID.TR: {
        break;
      }
      default: {
        endTagInTable(p, token);
      }
    }
  }
  function startTagInRow(p, token) {
    switch (token.tagID) {
      case TAG_ID.TH:
      case TAG_ID.TD: {
        p.openElements.clearBackToTableRowContext();
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_CELL;
        p.activeFormattingElements.insertMarker();
        break;
      }
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          startTagInTableBody(p, token);
        }
        break;
      }
      default: {
        startTagInTable(p, token);
      }
    }
  }
  function endTagInRow(p, token) {
    switch (token.tagID) {
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
        }
        break;
      }
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          endTagInTableBody(p, token);
        }
        break;
      }
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasInTableScope(token.tagID) || p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          endTagInTableBody(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TD:
      case TAG_ID.TH: {
        break;
      }
      default: {
        endTagInTable(p, token);
      }
    }
  }
  function startTagInCell(p, token) {
    const tn = token.tagID;
    if (TABLE_VOID_ELEMENTS.has(tn)) {
      if (p.openElements.hasInTableScope(TAG_ID.TD) || p.openElements.hasInTableScope(TAG_ID.TH)) {
        p._closeTableCell();
        startTagInRow(p, token);
      }
    } else {
      startTagInBody(p, token);
    }
  }
  function endTagInCell(p, token) {
    const tn = token.tagID;
    switch (tn) {
      case TAG_ID.TD:
      case TAG_ID.TH: {
        if (p.openElements.hasInTableScope(tn)) {
          p.openElements.generateImpliedEndTags();
          p.openElements.popUntilTagNamePopped(tn);
          p.activeFormattingElements.clearToLastMarker();
          p.insertionMode = InsertionMode.IN_ROW;
        }
        break;
      }
      case TAG_ID.TABLE:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(tn)) {
          p._closeTableCell();
          endTagInRow(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML: {
        break;
      }
      default: {
        endTagInBody(p, token);
      }
    }
  }
  function startTagInSelect(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.OPTION: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.OPTGROUP: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.INPUT:
      case TAG_ID.KEYGEN:
      case TAG_ID.TEXTAREA:
      case TAG_ID.SELECT: {
        if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
          p._resetInsertionMode();
          if (token.tagID !== TAG_ID.SELECT) {
            p._processStartTag(token);
          }
        }
        break;
      }
      case TAG_ID.SCRIPT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
    }
  }
  function endTagInSelect(p, token) {
    switch (token.tagID) {
      case TAG_ID.OPTGROUP: {
        if (p.openElements.stackTop > 0 && p.openElements.currentTagId === TAG_ID.OPTION && p.openElements.tagIDs[p.openElements.stackTop - 1] === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        break;
      }
      case TAG_ID.OPTION: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        break;
      }
      case TAG_ID.SELECT: {
        if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
          p._resetInsertionMode();
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
    }
  }
  function startTagInSelectInTable(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
      p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
      p._resetInsertionMode();
      p._processStartTag(token);
    } else {
      startTagInSelect(p, token);
    }
  }
  function endTagInSelectInTable(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
        p.onEndTag(token);
      }
    } else {
      endTagInSelect(p, token);
    }
  }
  function startTagInTemplate(p, token) {
    switch (token.tagID) {
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.SCRIPT:
      case TAG_ID.STYLE:
      case TAG_ID.TEMPLATE:
      case TAG_ID.TITLE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.CAPTION:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE;
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
        break;
      }
      case TAG_ID.COL: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_COLUMN_GROUP;
        p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
        startTagInColumnGroup(p, token);
        break;
      }
      case TAG_ID.TR: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE_BODY;
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        startTagInTableBody(p, token);
        break;
      }
      case TAG_ID.TD:
      case TAG_ID.TH: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_ROW;
        p.insertionMode = InsertionMode.IN_ROW;
        startTagInRow(p, token);
        break;
      }
      default: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_BODY;
        p.insertionMode = InsertionMode.IN_BODY;
        startTagInBody(p, token);
      }
    }
  }
  function endTagInTemplate(p, token) {
    if (token.tagID === TAG_ID.TEMPLATE) {
      templateEndTagInHead(p, token);
    }
  }
  function eofInTemplate(p, token) {
    if (p.openElements.tmplCount > 0) {
      p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
      p.activeFormattingElements.clearToLastMarker();
      p.tmplInsertionModeStack.shift();
      p._resetInsertionMode();
      p.onEof(token);
    } else {
      stopParsing(p, token);
    }
  }
  function startTagAfterBody(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      startTagInBody(p, token);
    } else {
      tokenAfterBody(p, token);
    }
  }
  function endTagAfterBody(p, token) {
    var _a2;
    if (token.tagID === TAG_ID.HTML) {
      if (!p.fragmentContext) {
        p.insertionMode = InsertionMode.AFTER_AFTER_BODY;
      }
      if (p.options.sourceCodeLocationInfo && p.openElements.tagIDs[0] === TAG_ID.HTML) {
        p._setEndLocation(p.openElements.items[0], token);
        const bodyElement = p.openElements.items[1];
        if (bodyElement && !((_a2 = p.treeAdapter.getNodeSourceCodeLocation(bodyElement)) === null || _a2 === void 0 ? void 0 : _a2.endTag)) {
          p._setEndLocation(bodyElement, token);
        }
      }
    } else {
      tokenAfterBody(p, token);
    }
  }
  function tokenAfterBody(p, token) {
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function startTagInFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.FRAMESET: {
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.FRAME: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
    }
  }
  function endTagInFrameset(p, token) {
    if (token.tagID === TAG_ID.FRAMESET && !p.openElements.isRootHtmlElementCurrent()) {
      p.openElements.pop();
      if (!p.fragmentContext && p.openElements.currentTagId !== TAG_ID.FRAMESET) {
        p.insertionMode = InsertionMode.AFTER_FRAMESET;
      }
    }
  }
  function startTagAfterFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
    }
  }
  function endTagAfterFrameset(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      p.insertionMode = InsertionMode.AFTER_AFTER_FRAMESET;
    }
  }
  function startTagAfterAfterBody(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      startTagInBody(p, token);
    } else {
      tokenAfterAfterBody(p, token);
    }
  }
  function tokenAfterAfterBody(p, token) {
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function startTagAfterAfterFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
    }
  }
  function nullCharacterInForeignContent(p, token) {
    token.chars = REPLACEMENT_CHARACTER;
    p._insertCharacters(token);
  }
  function characterInForeignContent(p, token) {
    p._insertCharacters(token);
    p.framesetOk = false;
  }
  function popUntilHtmlOrIntegrationPoint(p) {
    while (p.treeAdapter.getNamespaceURI(p.openElements.current) !== NS.HTML && !p._isIntegrationPoint(p.openElements.currentTagId, p.openElements.current)) {
      p.openElements.pop();
    }
  }
  function startTagInForeignContent(p, token) {
    if (causesExit(token)) {
      popUntilHtmlOrIntegrationPoint(p);
      p._startTagOutsideForeignContent(token);
    } else {
      const current = p._getAdjustedCurrentElement();
      const currentNs = p.treeAdapter.getNamespaceURI(current);
      if (currentNs === NS.MATHML) {
        adjustTokenMathMLAttrs(token);
      } else if (currentNs === NS.SVG) {
        adjustTokenSVGTagName(token);
        adjustTokenSVGAttrs(token);
      }
      adjustTokenXMLAttrs(token);
      if (token.selfClosing) {
        p._appendElement(token, currentNs);
      } else {
        p._insertElement(token, currentNs);
      }
      token.ackSelfClosing = true;
    }
  }
  function endTagInForeignContent(p, token) {
    if (token.tagID === TAG_ID.P || token.tagID === TAG_ID.BR) {
      popUntilHtmlOrIntegrationPoint(p);
      p._endTagOutsideForeignContent(token);
      return;
    }
    for (let i2 = p.openElements.stackTop; i2 > 0; i2--) {
      const element = p.openElements.items[i2];
      if (p.treeAdapter.getNamespaceURI(element) === NS.HTML) {
        p._endTagOutsideForeignContent(token);
        break;
      }
      const tagName = p.treeAdapter.getTagName(element);
      if (tagName.toLowerCase() === token.tagName) {
        token.tagName = tagName;
        p.openElements.shortenToLength(i2);
        break;
      }
    }
  }
  const VOID_ELEMENTS = /* @__PURE__ */ new Set([
    TAG_NAMES.AREA,
    TAG_NAMES.BASE,
    TAG_NAMES.BASEFONT,
    TAG_NAMES.BGSOUND,
    TAG_NAMES.BR,
    TAG_NAMES.COL,
    TAG_NAMES.EMBED,
    TAG_NAMES.FRAME,
    TAG_NAMES.HR,
    TAG_NAMES.IMG,
    TAG_NAMES.INPUT,
    TAG_NAMES.KEYGEN,
    TAG_NAMES.LINK,
    TAG_NAMES.META,
    TAG_NAMES.PARAM,
    TAG_NAMES.SOURCE,
    TAG_NAMES.TRACK,
    TAG_NAMES.WBR
  ]);
  function isVoidElement(node, options) {
    return options.treeAdapter.isElementNode(node) && options.treeAdapter.getNamespaceURI(node) === NS.HTML && VOID_ELEMENTS.has(options.treeAdapter.getTagName(node));
  }
  const defaultOpts = { treeAdapter: defaultTreeAdapter, scriptingEnabled: true };
  function serializeOuter(node, options) {
    const opts = { ...defaultOpts, ...options };
    return serializeNode(node, opts);
  }
  function serializeChildNodes(parentNode, options) {
    let html2 = "";
    const container = options.treeAdapter.isElementNode(parentNode) && options.treeAdapter.getTagName(parentNode) === TAG_NAMES.TEMPLATE && options.treeAdapter.getNamespaceURI(parentNode) === NS.HTML ? options.treeAdapter.getTemplateContent(parentNode) : parentNode;
    const childNodes = options.treeAdapter.getChildNodes(container);
    if (childNodes) {
      for (const currentNode of childNodes) {
        html2 += serializeNode(currentNode, options);
      }
    }
    return html2;
  }
  function serializeNode(node, options) {
    if (options.treeAdapter.isElementNode(node)) {
      return serializeElement(node, options);
    }
    if (options.treeAdapter.isTextNode(node)) {
      return serializeTextNode(node, options);
    }
    if (options.treeAdapter.isCommentNode(node)) {
      return serializeCommentNode(node, options);
    }
    if (options.treeAdapter.isDocumentTypeNode(node)) {
      return serializeDocumentTypeNode(node, options);
    }
    return "";
  }
  function serializeElement(node, options) {
    const tn = options.treeAdapter.getTagName(node);
    return `<${tn}${serializeAttributes(node, options)}>${isVoidElement(node, options) ? "" : `${serializeChildNodes(node, options)}</${tn}>`}`;
  }
  function serializeAttributes(node, { treeAdapter }) {
    let html2 = "";
    for (const attr2 of treeAdapter.getAttrList(node)) {
      html2 += " ";
      if (!attr2.namespace) {
        html2 += attr2.name;
      } else
        switch (attr2.namespace) {
          case NS.XML: {
            html2 += `xml:${attr2.name}`;
            break;
          }
          case NS.XMLNS: {
            if (attr2.name !== "xmlns") {
              html2 += "xmlns:";
            }
            html2 += attr2.name;
            break;
          }
          case NS.XLINK: {
            html2 += `xlink:${attr2.name}`;
            break;
          }
          default: {
            html2 += `${attr2.prefix}:${attr2.name}`;
          }
        }
      html2 += `="${escapeAttribute(attr2.value)}"`;
    }
    return html2;
  }
  function serializeTextNode(node, options) {
    const { treeAdapter } = options;
    const content = treeAdapter.getTextNodeContent(node);
    const parent2 = treeAdapter.getParentNode(node);
    const parentTn = parent2 && treeAdapter.isElementNode(parent2) && treeAdapter.getTagName(parent2);
    return parentTn && treeAdapter.getNamespaceURI(parent2) === NS.HTML && hasUnescapedText(parentTn, options.scriptingEnabled) ? content : escapeText(content);
  }
  function serializeCommentNode(node, { treeAdapter }) {
    return `<!--${treeAdapter.getCommentNodeContent(node)}-->`;
  }
  function serializeDocumentTypeNode(node, { treeAdapter }) {
    return `<!DOCTYPE ${treeAdapter.getDocumentTypeNodeName(node)}>`;
  }
  function parse$1(html2, options) {
    return Parser$1.parse(html2, options);
  }
  function parseFragment(fragmentContext, html2, options) {
    if (typeof fragmentContext === "string") {
      options = html2;
      html2 = fragmentContext;
      fragmentContext = null;
    }
    const parser = Parser$1.getFragmentParser(fragmentContext, options);
    parser.tokenizer.write(html2, true);
    return parser.getFragment();
  }
  function createTextNode(value) {
    return new Text(value);
  }
  function enquoteDoctypeId(id) {
    const quote = id.includes('"') ? "'" : '"';
    return quote + id + quote;
  }
  function serializeDoctypeContent(name2, publicId, systemId) {
    let str2 = "!DOCTYPE ";
    if (name2) {
      str2 += name2;
    }
    if (publicId) {
      str2 += ` PUBLIC ${enquoteDoctypeId(publicId)}`;
    } else if (systemId) {
      str2 += " SYSTEM";
    }
    if (systemId) {
      str2 += ` ${enquoteDoctypeId(systemId)}`;
    }
    return str2;
  }
  const adapter = {
    // Re-exports from domhandler
    isCommentNode: isComment,
    isElementNode: isTag,
    isTextNode: isText,
    //Node construction
    createDocument() {
      const node = new Document([]);
      node["x-mode"] = DOCUMENT_MODE.NO_QUIRKS;
      return node;
    },
    createDocumentFragment() {
      return new Document([]);
    },
    createElement(tagName, namespaceURI, attrs) {
      const attribs = /* @__PURE__ */ Object.create(null);
      const attribsNamespace = /* @__PURE__ */ Object.create(null);
      const attribsPrefix = /* @__PURE__ */ Object.create(null);
      for (let i2 = 0; i2 < attrs.length; i2++) {
        const attrName = attrs[i2].name;
        attribs[attrName] = attrs[i2].value;
        attribsNamespace[attrName] = attrs[i2].namespace;
        attribsPrefix[attrName] = attrs[i2].prefix;
      }
      const node = new Element(tagName, attribs, []);
      node.namespace = namespaceURI;
      node["x-attribsNamespace"] = attribsNamespace;
      node["x-attribsPrefix"] = attribsPrefix;
      return node;
    },
    createCommentNode(data2) {
      return new Comment(data2);
    },
    //Tree mutation
    appendChild(parentNode, newNode) {
      const prev2 = parentNode.children[parentNode.children.length - 1];
      if (prev2) {
        prev2.next = newNode;
        newNode.prev = prev2;
      }
      parentNode.children.push(newNode);
      newNode.parent = parentNode;
    },
    insertBefore(parentNode, newNode, referenceNode) {
      const insertionIdx = parentNode.children.indexOf(referenceNode);
      const { prev: prev2 } = referenceNode;
      if (prev2) {
        prev2.next = newNode;
        newNode.prev = prev2;
      }
      referenceNode.prev = newNode;
      newNode.next = referenceNode;
      parentNode.children.splice(insertionIdx, 0, newNode);
      newNode.parent = parentNode;
    },
    setTemplateContent(templateElement, contentElement) {
      adapter.appendChild(templateElement, contentElement);
    },
    getTemplateContent(templateElement) {
      return templateElement.children[0];
    },
    setDocumentType(document2, name2, publicId, systemId) {
      const data2 = serializeDoctypeContent(name2, publicId, systemId);
      let doctypeNode = document2.children.find((node) => isDirective(node) && node.name === "!doctype");
      if (doctypeNode) {
        doctypeNode.data = data2 !== null && data2 !== void 0 ? data2 : null;
      } else {
        doctypeNode = new ProcessingInstruction("!doctype", data2);
        adapter.appendChild(document2, doctypeNode);
      }
      doctypeNode["x-name"] = name2 !== null && name2 !== void 0 ? name2 : void 0;
      doctypeNode["x-publicId"] = publicId !== null && publicId !== void 0 ? publicId : void 0;
      doctypeNode["x-systemId"] = systemId !== null && systemId !== void 0 ? systemId : void 0;
    },
    setDocumentMode(document2, mode) {
      document2["x-mode"] = mode;
    },
    getDocumentMode(document2) {
      return document2["x-mode"];
    },
    detachNode(node) {
      if (node.parent) {
        const idx = node.parent.children.indexOf(node);
        const { prev: prev2, next: next2 } = node;
        node.prev = null;
        node.next = null;
        if (prev2) {
          prev2.next = next2;
        }
        if (next2) {
          next2.prev = prev2;
        }
        node.parent.children.splice(idx, 1);
        node.parent = null;
      }
    },
    insertText(parentNode, text2) {
      const lastChild = parentNode.children[parentNode.children.length - 1];
      if (lastChild && isText(lastChild)) {
        lastChild.data += text2;
      } else {
        adapter.appendChild(parentNode, createTextNode(text2));
      }
    },
    insertTextBefore(parentNode, text2, referenceNode) {
      const prevNode = parentNode.children[parentNode.children.indexOf(referenceNode) - 1];
      if (prevNode && isText(prevNode)) {
        prevNode.data += text2;
      } else {
        adapter.insertBefore(parentNode, createTextNode(text2), referenceNode);
      }
    },
    adoptAttributes(recipient, attrs) {
      for (let i2 = 0; i2 < attrs.length; i2++) {
        const attrName = attrs[i2].name;
        if (typeof recipient.attribs[attrName] === "undefined") {
          recipient.attribs[attrName] = attrs[i2].value;
          recipient["x-attribsNamespace"][attrName] = attrs[i2].namespace;
          recipient["x-attribsPrefix"][attrName] = attrs[i2].prefix;
        }
      }
    },
    //Tree traversing
    getFirstChild(node) {
      return node.children[0];
    },
    getChildNodes(node) {
      return node.children;
    },
    getParentNode(node) {
      return node.parent;
    },
    getAttrList(element) {
      return element.attributes;
    },
    //Node data
    getTagName(element) {
      return element.name;
    },
    getNamespaceURI(element) {
      return element.namespace;
    },
    getTextNodeContent(textNode) {
      return textNode.data;
    },
    getCommentNodeContent(commentNode) {
      return commentNode.data;
    },
    getDocumentTypeNodeName(doctypeNode) {
      var _a2;
      return (_a2 = doctypeNode["x-name"]) !== null && _a2 !== void 0 ? _a2 : "";
    },
    getDocumentTypeNodePublicId(doctypeNode) {
      var _a2;
      return (_a2 = doctypeNode["x-publicId"]) !== null && _a2 !== void 0 ? _a2 : "";
    },
    getDocumentTypeNodeSystemId(doctypeNode) {
      var _a2;
      return (_a2 = doctypeNode["x-systemId"]) !== null && _a2 !== void 0 ? _a2 : "";
    },
    //Node types
    isDocumentTypeNode(node) {
      return isDirective(node) && node.name === "!doctype";
    },
    // Source code location
    setNodeSourceCodeLocation(node, location) {
      if (location) {
        node.startIndex = location.startOffset;
        node.endIndex = location.endOffset;
      }
      node.sourceCodeLocation = location;
    },
    getNodeSourceCodeLocation(node) {
      return node.sourceCodeLocation;
    },
    updateNodeSourceCodeLocation(node, endLocation) {
      if (endLocation.endOffset != null)
        node.endIndex = endLocation.endOffset;
      node.sourceCodeLocation = {
        ...node.sourceCodeLocation,
        ...endLocation
      };
    }
  };
  function parseWithParse5(content, options, isDocument2, context) {
    const opts = {
      scriptingEnabled: typeof options.scriptingEnabled === "boolean" ? options.scriptingEnabled : true,
      treeAdapter: adapter,
      sourceCodeLocationInfo: options.sourceCodeLocationInfo
    };
    return isDocument2 ? parse$1(content, opts) : parseFragment(context, content, opts);
  }
  const renderOpts = { treeAdapter: adapter };
  function renderWithParse5(dom) {
    const nodes = "length" in dom ? dom : [dom];
    for (let index2 = 0; index2 < nodes.length; index2 += 1) {
      const node = nodes[index2];
      if (isDocument(node)) {
        Array.prototype.splice.call(nodes, index2, 1, ...node.children);
      }
    }
    let result = "";
    for (let index2 = 0; index2 < nodes.length; index2 += 1) {
      const node = nodes[index2];
      result += serializeOuter(node, renderOpts);
    }
    return result;
  }
  var CharCodes;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["Tab"] = 9] = "Tab";
    CharCodes2[CharCodes2["NewLine"] = 10] = "NewLine";
    CharCodes2[CharCodes2["FormFeed"] = 12] = "FormFeed";
    CharCodes2[CharCodes2["CarriageReturn"] = 13] = "CarriageReturn";
    CharCodes2[CharCodes2["Space"] = 32] = "Space";
    CharCodes2[CharCodes2["ExclamationMark"] = 33] = "ExclamationMark";
    CharCodes2[CharCodes2["Number"] = 35] = "Number";
    CharCodes2[CharCodes2["Amp"] = 38] = "Amp";
    CharCodes2[CharCodes2["SingleQuote"] = 39] = "SingleQuote";
    CharCodes2[CharCodes2["DoubleQuote"] = 34] = "DoubleQuote";
    CharCodes2[CharCodes2["Dash"] = 45] = "Dash";
    CharCodes2[CharCodes2["Slash"] = 47] = "Slash";
    CharCodes2[CharCodes2["Zero"] = 48] = "Zero";
    CharCodes2[CharCodes2["Nine"] = 57] = "Nine";
    CharCodes2[CharCodes2["Semi"] = 59] = "Semi";
    CharCodes2[CharCodes2["Lt"] = 60] = "Lt";
    CharCodes2[CharCodes2["Eq"] = 61] = "Eq";
    CharCodes2[CharCodes2["Gt"] = 62] = "Gt";
    CharCodes2[CharCodes2["Questionmark"] = 63] = "Questionmark";
    CharCodes2[CharCodes2["UpperA"] = 65] = "UpperA";
    CharCodes2[CharCodes2["LowerA"] = 97] = "LowerA";
    CharCodes2[CharCodes2["UpperF"] = 70] = "UpperF";
    CharCodes2[CharCodes2["LowerF"] = 102] = "LowerF";
    CharCodes2[CharCodes2["UpperZ"] = 90] = "UpperZ";
    CharCodes2[CharCodes2["LowerZ"] = 122] = "LowerZ";
    CharCodes2[CharCodes2["LowerX"] = 120] = "LowerX";
    CharCodes2[CharCodes2["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
  })(CharCodes || (CharCodes = {}));
  var State$2;
  (function(State2) {
    State2[State2["Text"] = 1] = "Text";
    State2[State2["BeforeTagName"] = 2] = "BeforeTagName";
    State2[State2["InTagName"] = 3] = "InTagName";
    State2[State2["InSelfClosingTag"] = 4] = "InSelfClosingTag";
    State2[State2["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
    State2[State2["InClosingTagName"] = 6] = "InClosingTagName";
    State2[State2["AfterClosingTagName"] = 7] = "AfterClosingTagName";
    State2[State2["BeforeAttributeName"] = 8] = "BeforeAttributeName";
    State2[State2["InAttributeName"] = 9] = "InAttributeName";
    State2[State2["AfterAttributeName"] = 10] = "AfterAttributeName";
    State2[State2["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
    State2[State2["InAttributeValueDq"] = 12] = "InAttributeValueDq";
    State2[State2["InAttributeValueSq"] = 13] = "InAttributeValueSq";
    State2[State2["InAttributeValueNq"] = 14] = "InAttributeValueNq";
    State2[State2["BeforeDeclaration"] = 15] = "BeforeDeclaration";
    State2[State2["InDeclaration"] = 16] = "InDeclaration";
    State2[State2["InProcessingInstruction"] = 17] = "InProcessingInstruction";
    State2[State2["BeforeComment"] = 18] = "BeforeComment";
    State2[State2["CDATASequence"] = 19] = "CDATASequence";
    State2[State2["InSpecialComment"] = 20] = "InSpecialComment";
    State2[State2["InCommentLike"] = 21] = "InCommentLike";
    State2[State2["BeforeSpecialS"] = 22] = "BeforeSpecialS";
    State2[State2["SpecialStartSequence"] = 23] = "SpecialStartSequence";
    State2[State2["InSpecialTag"] = 24] = "InSpecialTag";
    State2[State2["BeforeEntity"] = 25] = "BeforeEntity";
    State2[State2["BeforeNumericEntity"] = 26] = "BeforeNumericEntity";
    State2[State2["InNamedEntity"] = 27] = "InNamedEntity";
    State2[State2["InNumericEntity"] = 28] = "InNumericEntity";
    State2[State2["InHexEntity"] = 29] = "InHexEntity";
  })(State$2 || (State$2 = {}));
  function isWhitespace$1(c) {
    return c === CharCodes.Space || c === CharCodes.NewLine || c === CharCodes.Tab || c === CharCodes.FormFeed || c === CharCodes.CarriageReturn;
  }
  function isEndOfTagSection(c) {
    return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace$1(c);
  }
  function isNumber(c) {
    return c >= CharCodes.Zero && c <= CharCodes.Nine;
  }
  function isASCIIAlpha(c) {
    return c >= CharCodes.LowerA && c <= CharCodes.LowerZ || c >= CharCodes.UpperA && c <= CharCodes.UpperZ;
  }
  function isHexDigit(c) {
    return c >= CharCodes.UpperA && c <= CharCodes.UpperF || c >= CharCodes.LowerA && c <= CharCodes.LowerF;
  }
  var QuoteType;
  (function(QuoteType2) {
    QuoteType2[QuoteType2["NoValue"] = 0] = "NoValue";
    QuoteType2[QuoteType2["Unquoted"] = 1] = "Unquoted";
    QuoteType2[QuoteType2["Single"] = 2] = "Single";
    QuoteType2[QuoteType2["Double"] = 3] = "Double";
  })(QuoteType || (QuoteType = {}));
  const Sequences = {
    Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
    CdataEnd: new Uint8Array([93, 93, 62]),
    CommentEnd: new Uint8Array([45, 45, 62]),
    ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
    StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
    TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101])
    // `</title`
  };
  class Tokenizer {
    constructor({ xmlMode = false, decodeEntities = true }, cbs) {
      this.cbs = cbs;
      this.state = State$2.Text;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.baseState = State$2.Text;
      this.isSpecial = false;
      this.running = true;
      this.offset = 0;
      this.currentSequence = void 0;
      this.sequenceIndex = 0;
      this.trieIndex = 0;
      this.trieCurrent = 0;
      this.entityResult = 0;
      this.entityExcess = 0;
      this.xmlMode = xmlMode;
      this.decodeEntities = decodeEntities;
      this.entityTrie = xmlMode ? xmlDecodeTree : htmlDecodeTree;
    }
    reset() {
      this.state = State$2.Text;
      this.buffer = "";
      this.sectionStart = 0;
      this.index = 0;
      this.baseState = State$2.Text;
      this.currentSequence = void 0;
      this.running = true;
      this.offset = 0;
    }
    write(chunk) {
      this.offset += this.buffer.length;
      this.buffer = chunk;
      this.parse();
    }
    end() {
      if (this.running)
        this.finish();
    }
    pause() {
      this.running = false;
    }
    resume() {
      this.running = true;
      if (this.index < this.buffer.length + this.offset) {
        this.parse();
      }
    }
    /**
     * The current index within all of the written data.
     */
    getIndex() {
      return this.index;
    }
    /**
     * The start of the current section.
     */
    getSectionStart() {
      return this.sectionStart;
    }
    stateText(c) {
      if (c === CharCodes.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes.Lt)) {
        if (this.index > this.sectionStart) {
          this.cbs.ontext(this.sectionStart, this.index);
        }
        this.state = State$2.BeforeTagName;
        this.sectionStart = this.index;
      } else if (this.decodeEntities && c === CharCodes.Amp) {
        this.state = State$2.BeforeEntity;
      }
    }
    stateSpecialStartSequence(c) {
      const isEnd = this.sequenceIndex === this.currentSequence.length;
      const isMatch = isEnd ? (
        // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      ) : (
        // Otherwise, do a case-insensitive comparison
        (c | 32) === this.currentSequence[this.sequenceIndex]
      );
      if (!isMatch) {
        this.isSpecial = false;
      } else if (!isEnd) {
        this.sequenceIndex++;
        return;
      }
      this.sequenceIndex = 0;
      this.state = State$2.InTagName;
      this.stateInTagName(c);
    }
    /** Look for an end tag. For <title> tags, also decode entities. */
    stateInSpecialTag(c) {
      if (this.sequenceIndex === this.currentSequence.length) {
        if (c === CharCodes.Gt || isWhitespace$1(c)) {
          const endOfText = this.index - this.currentSequence.length;
          if (this.sectionStart < endOfText) {
            const actualIndex = this.index;
            this.index = endOfText;
            this.cbs.ontext(this.sectionStart, endOfText);
            this.index = actualIndex;
          }
          this.isSpecial = false;
          this.sectionStart = endOfText + 2;
          this.stateInClosingTagName(c);
          return;
        }
        this.sequenceIndex = 0;
      }
      if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex += 1;
      } else if (this.sequenceIndex === 0) {
        if (this.currentSequence === Sequences.TitleEnd) {
          if (this.decodeEntities && c === CharCodes.Amp) {
            this.state = State$2.BeforeEntity;
          }
        } else if (this.fastForwardTo(CharCodes.Lt)) {
          this.sequenceIndex = 1;
        }
      } else {
        this.sequenceIndex = Number(c === CharCodes.Lt);
      }
    }
    stateCDATASequence(c) {
      if (c === Sequences.Cdata[this.sequenceIndex]) {
        if (++this.sequenceIndex === Sequences.Cdata.length) {
          this.state = State$2.InCommentLike;
          this.currentSequence = Sequences.CdataEnd;
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
        }
      } else {
        this.sequenceIndex = 0;
        this.state = State$2.InDeclaration;
        this.stateInDeclaration(c);
      }
    }
    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */
    fastForwardTo(c) {
      while (++this.index < this.buffer.length + this.offset) {
        if (this.buffer.charCodeAt(this.index - this.offset) === c) {
          return true;
        }
      }
      this.index = this.buffer.length + this.offset - 1;
      return false;
    }
    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */
    stateInCommentLike(c) {
      if (c === this.currentSequence[this.sequenceIndex]) {
        if (++this.sequenceIndex === this.currentSequence.length) {
          if (this.currentSequence === Sequences.CdataEnd) {
            this.cbs.oncdata(this.sectionStart, this.index, 2);
          } else {
            this.cbs.oncomment(this.sectionStart, this.index, 2);
          }
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
          this.state = State$2.Text;
        }
      } else if (this.sequenceIndex === 0) {
        if (this.fastForwardTo(this.currentSequence[0])) {
          this.sequenceIndex = 1;
        }
      } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
        this.sequenceIndex = 0;
      }
    }
    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */
    isTagStartChar(c) {
      return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
    }
    startSpecial(sequence, offset) {
      this.isSpecial = true;
      this.currentSequence = sequence;
      this.sequenceIndex = offset;
      this.state = State$2.SpecialStartSequence;
    }
    stateBeforeTagName(c) {
      if (c === CharCodes.ExclamationMark) {
        this.state = State$2.BeforeDeclaration;
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes.Questionmark) {
        this.state = State$2.InProcessingInstruction;
        this.sectionStart = this.index + 1;
      } else if (this.isTagStartChar(c)) {
        const lower = c | 32;
        this.sectionStart = this.index;
        if (!this.xmlMode && lower === Sequences.TitleEnd[2]) {
          this.startSpecial(Sequences.TitleEnd, 3);
        } else {
          this.state = !this.xmlMode && lower === Sequences.ScriptEnd[2] ? State$2.BeforeSpecialS : State$2.InTagName;
        }
      } else if (c === CharCodes.Slash) {
        this.state = State$2.BeforeClosingTagName;
      } else {
        this.state = State$2.Text;
        this.stateText(c);
      }
    }
    stateInTagName(c) {
      if (isEndOfTagSection(c)) {
        this.cbs.onopentagname(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = State$2.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      }
    }
    stateBeforeClosingTagName(c) {
      if (isWhitespace$1(c))
        ;
      else if (c === CharCodes.Gt) {
        this.state = State$2.Text;
      } else {
        this.state = this.isTagStartChar(c) ? State$2.InClosingTagName : State$2.InSpecialComment;
        this.sectionStart = this.index;
      }
    }
    stateInClosingTagName(c) {
      if (c === CharCodes.Gt || isWhitespace$1(c)) {
        this.cbs.onclosetag(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = State$2.AfterClosingTagName;
        this.stateAfterClosingTagName(c);
      }
    }
    stateAfterClosingTagName(c) {
      if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
        this.state = State$2.Text;
        this.baseState = State$2.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeAttributeName(c) {
      if (c === CharCodes.Gt) {
        this.cbs.onopentagend(this.index);
        if (this.isSpecial) {
          this.state = State$2.InSpecialTag;
          this.sequenceIndex = 0;
        } else {
          this.state = State$2.Text;
        }
        this.baseState = this.state;
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes.Slash) {
        this.state = State$2.InSelfClosingTag;
      } else if (!isWhitespace$1(c)) {
        this.state = State$2.InAttributeName;
        this.sectionStart = this.index;
      }
    }
    stateInSelfClosingTag(c) {
      if (c === CharCodes.Gt) {
        this.cbs.onselfclosingtag(this.index);
        this.state = State$2.Text;
        this.baseState = State$2.Text;
        this.sectionStart = this.index + 1;
        this.isSpecial = false;
      } else if (!isWhitespace$1(c)) {
        this.state = State$2.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      }
    }
    stateInAttributeName(c) {
      if (c === CharCodes.Eq || isEndOfTagSection(c)) {
        this.cbs.onattribname(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.state = State$2.AfterAttributeName;
        this.stateAfterAttributeName(c);
      }
    }
    stateAfterAttributeName(c) {
      if (c === CharCodes.Eq) {
        this.state = State$2.BeforeAttributeValue;
      } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
        this.cbs.onattribend(QuoteType.NoValue, this.index);
        this.state = State$2.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      } else if (!isWhitespace$1(c)) {
        this.cbs.onattribend(QuoteType.NoValue, this.index);
        this.state = State$2.InAttributeName;
        this.sectionStart = this.index;
      }
    }
    stateBeforeAttributeValue(c) {
      if (c === CharCodes.DoubleQuote) {
        this.state = State$2.InAttributeValueDq;
        this.sectionStart = this.index + 1;
      } else if (c === CharCodes.SingleQuote) {
        this.state = State$2.InAttributeValueSq;
        this.sectionStart = this.index + 1;
      } else if (!isWhitespace$1(c)) {
        this.sectionStart = this.index;
        this.state = State$2.InAttributeValueNq;
        this.stateInAttributeValueNoQuotes(c);
      }
    }
    handleInAttributeValue(c, quote) {
      if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index);
        this.state = State$2.BeforeAttributeName;
      } else if (this.decodeEntities && c === CharCodes.Amp) {
        this.baseState = this.state;
        this.state = State$2.BeforeEntity;
      }
    }
    stateInAttributeValueDoubleQuotes(c) {
      this.handleInAttributeValue(c, CharCodes.DoubleQuote);
    }
    stateInAttributeValueSingleQuotes(c) {
      this.handleInAttributeValue(c, CharCodes.SingleQuote);
    }
    stateInAttributeValueNoQuotes(c) {
      if (isWhitespace$1(c) || c === CharCodes.Gt) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = -1;
        this.cbs.onattribend(QuoteType.Unquoted, this.index);
        this.state = State$2.BeforeAttributeName;
        this.stateBeforeAttributeName(c);
      } else if (this.decodeEntities && c === CharCodes.Amp) {
        this.baseState = this.state;
        this.state = State$2.BeforeEntity;
      }
    }
    stateBeforeDeclaration(c) {
      if (c === CharCodes.OpeningSquareBracket) {
        this.state = State$2.CDATASequence;
        this.sequenceIndex = 0;
      } else {
        this.state = c === CharCodes.Dash ? State$2.BeforeComment : State$2.InDeclaration;
      }
    }
    stateInDeclaration(c) {
      if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
        this.cbs.ondeclaration(this.sectionStart, this.index);
        this.state = State$2.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateInProcessingInstruction(c) {
      if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
        this.cbs.onprocessinginstruction(this.sectionStart, this.index);
        this.state = State$2.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeComment(c) {
      if (c === CharCodes.Dash) {
        this.state = State$2.InCommentLike;
        this.currentSequence = Sequences.CommentEnd;
        this.sequenceIndex = 2;
        this.sectionStart = this.index + 1;
      } else {
        this.state = State$2.InDeclaration;
      }
    }
    stateInSpecialComment(c) {
      if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
        this.cbs.oncomment(this.sectionStart, this.index, 0);
        this.state = State$2.Text;
        this.sectionStart = this.index + 1;
      }
    }
    stateBeforeSpecialS(c) {
      const lower = c | 32;
      if (lower === Sequences.ScriptEnd[3]) {
        this.startSpecial(Sequences.ScriptEnd, 4);
      } else if (lower === Sequences.StyleEnd[3]) {
        this.startSpecial(Sequences.StyleEnd, 4);
      } else {
        this.state = State$2.InTagName;
        this.stateInTagName(c);
      }
    }
    stateBeforeEntity(c) {
      this.entityExcess = 1;
      this.entityResult = 0;
      if (c === CharCodes.Number) {
        this.state = State$2.BeforeNumericEntity;
      } else if (c === CharCodes.Amp)
        ;
      else {
        this.trieIndex = 0;
        this.trieCurrent = this.entityTrie[0];
        this.state = State$2.InNamedEntity;
        this.stateInNamedEntity(c);
      }
    }
    stateInNamedEntity(c) {
      this.entityExcess += 1;
      this.trieIndex = determineBranch(this.entityTrie, this.trieCurrent, this.trieIndex + 1, c);
      if (this.trieIndex < 0) {
        this.emitNamedEntity();
        this.index--;
        return;
      }
      this.trieCurrent = this.entityTrie[this.trieIndex];
      const masked = this.trieCurrent & BinTrieFlags.VALUE_LENGTH;
      if (masked) {
        const valueLength = (masked >> 14) - 1;
        if (!this.allowLegacyEntity() && c !== CharCodes.Semi) {
          this.trieIndex += valueLength;
        } else {
          const entityStart = this.index - this.entityExcess + 1;
          if (entityStart > this.sectionStart) {
            this.emitPartial(this.sectionStart, entityStart);
          }
          this.entityResult = this.trieIndex;
          this.trieIndex += valueLength;
          this.entityExcess = 0;
          this.sectionStart = this.index + 1;
          if (valueLength === 0) {
            this.emitNamedEntity();
          }
        }
      }
    }
    emitNamedEntity() {
      this.state = this.baseState;
      if (this.entityResult === 0) {
        return;
      }
      const valueLength = (this.entityTrie[this.entityResult] & BinTrieFlags.VALUE_LENGTH) >> 14;
      switch (valueLength) {
        case 1: {
          this.emitCodePoint(this.entityTrie[this.entityResult] & ~BinTrieFlags.VALUE_LENGTH);
          break;
        }
        case 2: {
          this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
          break;
        }
        case 3: {
          this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
          this.emitCodePoint(this.entityTrie[this.entityResult + 2]);
        }
      }
    }
    stateBeforeNumericEntity(c) {
      if ((c | 32) === CharCodes.LowerX) {
        this.entityExcess++;
        this.state = State$2.InHexEntity;
      } else {
        this.state = State$2.InNumericEntity;
        this.stateInNumericEntity(c);
      }
    }
    emitNumericEntity(strict) {
      const entityStart = this.index - this.entityExcess - 1;
      const numberStart = entityStart + 2 + Number(this.state === State$2.InHexEntity);
      if (numberStart !== this.index) {
        if (entityStart > this.sectionStart) {
          this.emitPartial(this.sectionStart, entityStart);
        }
        this.sectionStart = this.index + Number(strict);
        this.emitCodePoint(replaceCodePoint(this.entityResult));
      }
      this.state = this.baseState;
    }
    stateInNumericEntity(c) {
      if (c === CharCodes.Semi) {
        this.emitNumericEntity(true);
      } else if (isNumber(c)) {
        this.entityResult = this.entityResult * 10 + (c - CharCodes.Zero);
        this.entityExcess++;
      } else {
        if (this.allowLegacyEntity()) {
          this.emitNumericEntity(false);
        } else {
          this.state = this.baseState;
        }
        this.index--;
      }
    }
    stateInHexEntity(c) {
      if (c === CharCodes.Semi) {
        this.emitNumericEntity(true);
      } else if (isNumber(c)) {
        this.entityResult = this.entityResult * 16 + (c - CharCodes.Zero);
        this.entityExcess++;
      } else if (isHexDigit(c)) {
        this.entityResult = this.entityResult * 16 + ((c | 32) - CharCodes.LowerA + 10);
        this.entityExcess++;
      } else {
        if (this.allowLegacyEntity()) {
          this.emitNumericEntity(false);
        } else {
          this.state = this.baseState;
        }
        this.index--;
      }
    }
    allowLegacyEntity() {
      return !this.xmlMode && (this.baseState === State$2.Text || this.baseState === State$2.InSpecialTag);
    }
    /**
     * Remove data that has already been consumed from the buffer.
     */
    cleanup() {
      if (this.running && this.sectionStart !== this.index) {
        if (this.state === State$2.Text || this.state === State$2.InSpecialTag && this.sequenceIndex === 0) {
          this.cbs.ontext(this.sectionStart, this.index);
          this.sectionStart = this.index;
        } else if (this.state === State$2.InAttributeValueDq || this.state === State$2.InAttributeValueSq || this.state === State$2.InAttributeValueNq) {
          this.cbs.onattribdata(this.sectionStart, this.index);
          this.sectionStart = this.index;
        }
      }
    }
    shouldContinue() {
      return this.index < this.buffer.length + this.offset && this.running;
    }
    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    parse() {
      while (this.shouldContinue()) {
        const c = this.buffer.charCodeAt(this.index - this.offset);
        switch (this.state) {
          case State$2.Text: {
            this.stateText(c);
            break;
          }
          case State$2.SpecialStartSequence: {
            this.stateSpecialStartSequence(c);
            break;
          }
          case State$2.InSpecialTag: {
            this.stateInSpecialTag(c);
            break;
          }
          case State$2.CDATASequence: {
            this.stateCDATASequence(c);
            break;
          }
          case State$2.InAttributeValueDq: {
            this.stateInAttributeValueDoubleQuotes(c);
            break;
          }
          case State$2.InAttributeName: {
            this.stateInAttributeName(c);
            break;
          }
          case State$2.InCommentLike: {
            this.stateInCommentLike(c);
            break;
          }
          case State$2.InSpecialComment: {
            this.stateInSpecialComment(c);
            break;
          }
          case State$2.BeforeAttributeName: {
            this.stateBeforeAttributeName(c);
            break;
          }
          case State$2.InTagName: {
            this.stateInTagName(c);
            break;
          }
          case State$2.InClosingTagName: {
            this.stateInClosingTagName(c);
            break;
          }
          case State$2.BeforeTagName: {
            this.stateBeforeTagName(c);
            break;
          }
          case State$2.AfterAttributeName: {
            this.stateAfterAttributeName(c);
            break;
          }
          case State$2.InAttributeValueSq: {
            this.stateInAttributeValueSingleQuotes(c);
            break;
          }
          case State$2.BeforeAttributeValue: {
            this.stateBeforeAttributeValue(c);
            break;
          }
          case State$2.BeforeClosingTagName: {
            this.stateBeforeClosingTagName(c);
            break;
          }
          case State$2.AfterClosingTagName: {
            this.stateAfterClosingTagName(c);
            break;
          }
          case State$2.BeforeSpecialS: {
            this.stateBeforeSpecialS(c);
            break;
          }
          case State$2.InAttributeValueNq: {
            this.stateInAttributeValueNoQuotes(c);
            break;
          }
          case State$2.InSelfClosingTag: {
            this.stateInSelfClosingTag(c);
            break;
          }
          case State$2.InDeclaration: {
            this.stateInDeclaration(c);
            break;
          }
          case State$2.BeforeDeclaration: {
            this.stateBeforeDeclaration(c);
            break;
          }
          case State$2.BeforeComment: {
            this.stateBeforeComment(c);
            break;
          }
          case State$2.InProcessingInstruction: {
            this.stateInProcessingInstruction(c);
            break;
          }
          case State$2.InNamedEntity: {
            this.stateInNamedEntity(c);
            break;
          }
          case State$2.BeforeEntity: {
            this.stateBeforeEntity(c);
            break;
          }
          case State$2.InHexEntity: {
            this.stateInHexEntity(c);
            break;
          }
          case State$2.InNumericEntity: {
            this.stateInNumericEntity(c);
            break;
          }
          default: {
            this.stateBeforeNumericEntity(c);
          }
        }
        this.index++;
      }
      this.cleanup();
    }
    finish() {
      if (this.state === State$2.InNamedEntity) {
        this.emitNamedEntity();
      }
      if (this.sectionStart < this.index) {
        this.handleTrailingData();
      }
      this.cbs.onend();
    }
    /** Handle any trailing data. */
    handleTrailingData() {
      const endIndex = this.buffer.length + this.offset;
      if (this.state === State$2.InCommentLike) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, endIndex, 0);
        } else {
          this.cbs.oncomment(this.sectionStart, endIndex, 0);
        }
      } else if (this.state === State$2.InNumericEntity && this.allowLegacyEntity()) {
        this.emitNumericEntity(false);
      } else if (this.state === State$2.InHexEntity && this.allowLegacyEntity()) {
        this.emitNumericEntity(false);
      } else if (this.state === State$2.InTagName || this.state === State$2.BeforeAttributeName || this.state === State$2.BeforeAttributeValue || this.state === State$2.AfterAttributeName || this.state === State$2.InAttributeName || this.state === State$2.InAttributeValueSq || this.state === State$2.InAttributeValueDq || this.state === State$2.InAttributeValueNq || this.state === State$2.InClosingTagName)
        ;
      else {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
    emitPartial(start, endIndex) {
      if (this.baseState !== State$2.Text && this.baseState !== State$2.InSpecialTag) {
        this.cbs.onattribdata(start, endIndex);
      } else {
        this.cbs.ontext(start, endIndex);
      }
    }
    emitCodePoint(cp) {
      if (this.baseState !== State$2.Text && this.baseState !== State$2.InSpecialTag) {
        this.cbs.onattribentity(cp);
      } else {
        this.cbs.ontextentity(cp);
      }
    }
  }
  const formTags = /* @__PURE__ */ new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea"
  ]);
  const pTag = /* @__PURE__ */ new Set(["p"]);
  const tableSectionTags = /* @__PURE__ */ new Set(["thead", "tbody"]);
  const ddtTags = /* @__PURE__ */ new Set(["dd", "dt"]);
  const rtpTags = /* @__PURE__ */ new Set(["rt", "rp"]);
  const openImpliesClose = /* @__PURE__ */ new Map([
    ["tr", /* @__PURE__ */ new Set(["tr", "th", "td"])],
    ["th", /* @__PURE__ */ new Set(["th"])],
    ["td", /* @__PURE__ */ new Set(["thead", "th", "td"])],
    ["body", /* @__PURE__ */ new Set(["head", "link", "script"])],
    ["li", /* @__PURE__ */ new Set(["li"])],
    ["p", pTag],
    ["h1", pTag],
    ["h2", pTag],
    ["h3", pTag],
    ["h4", pTag],
    ["h5", pTag],
    ["h6", pTag],
    ["select", formTags],
    ["input", formTags],
    ["output", formTags],
    ["button", formTags],
    ["datalist", formTags],
    ["textarea", formTags],
    ["option", /* @__PURE__ */ new Set(["option"])],
    ["optgroup", /* @__PURE__ */ new Set(["optgroup", "option"])],
    ["dd", ddtTags],
    ["dt", ddtTags],
    ["address", pTag],
    ["article", pTag],
    ["aside", pTag],
    ["blockquote", pTag],
    ["details", pTag],
    ["div", pTag],
    ["dl", pTag],
    ["fieldset", pTag],
    ["figcaption", pTag],
    ["figure", pTag],
    ["footer", pTag],
    ["form", pTag],
    ["header", pTag],
    ["hr", pTag],
    ["main", pTag],
    ["nav", pTag],
    ["ol", pTag],
    ["pre", pTag],
    ["section", pTag],
    ["table", pTag],
    ["ul", pTag],
    ["rt", rtpTags],
    ["rp", rtpTags],
    ["tbody", tableSectionTags],
    ["tfoot", tableSectionTags]
  ]);
  const voidElements = /* @__PURE__ */ new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);
  const foreignContextElements = /* @__PURE__ */ new Set(["math", "svg"]);
  const htmlIntegrationElements = /* @__PURE__ */ new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignobject",
    "desc",
    "title"
  ]);
  const reNameEnd = /\s|\//;
  class Parser {
    constructor(cbs, options = {}) {
      var _a2, _b, _c, _d, _e;
      this.options = options;
      this.startIndex = 0;
      this.endIndex = 0;
      this.openTagStart = 0;
      this.tagname = "";
      this.attribname = "";
      this.attribvalue = "";
      this.attribs = null;
      this.stack = [];
      this.foreignContext = [];
      this.buffers = [];
      this.bufferOffset = 0;
      this.writeIndex = 0;
      this.ended = false;
      this.cbs = cbs !== null && cbs !== void 0 ? cbs : {};
      this.lowerCaseTagNames = (_a2 = options.lowerCaseTags) !== null && _a2 !== void 0 ? _a2 : !options.xmlMode;
      this.lowerCaseAttributeNames = (_b = options.lowerCaseAttributeNames) !== null && _b !== void 0 ? _b : !options.xmlMode;
      this.tokenizer = new ((_c = options.Tokenizer) !== null && _c !== void 0 ? _c : Tokenizer)(this.options, this);
      (_e = (_d = this.cbs).onparserinit) === null || _e === void 0 ? void 0 : _e.call(_d, this);
    }
    // Tokenizer event handlers
    /** @internal */
    ontext(start, endIndex) {
      var _a2, _b;
      const data2 = this.getSlice(start, endIndex);
      this.endIndex = endIndex - 1;
      (_b = (_a2 = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a2, data2);
      this.startIndex = endIndex;
    }
    /** @internal */
    ontextentity(cp) {
      var _a2, _b;
      const index2 = this.tokenizer.getSectionStart();
      this.endIndex = index2 - 1;
      (_b = (_a2 = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a2, fromCodePoint$1(cp));
      this.startIndex = index2;
    }
    isVoidElement(name2) {
      return !this.options.xmlMode && voidElements.has(name2);
    }
    /** @internal */
    onopentagname(start, endIndex) {
      this.endIndex = endIndex;
      let name2 = this.getSlice(start, endIndex);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      this.emitOpenTag(name2);
    }
    emitOpenTag(name2) {
      var _a2, _b, _c, _d;
      this.openTagStart = this.startIndex;
      this.tagname = name2;
      const impliesClose = !this.options.xmlMode && openImpliesClose.get(name2);
      if (impliesClose) {
        while (this.stack.length > 0 && impliesClose.has(this.stack[this.stack.length - 1])) {
          const element = this.stack.pop();
          (_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a2, element, true);
        }
      }
      if (!this.isVoidElement(name2)) {
        this.stack.push(name2);
        if (foreignContextElements.has(name2)) {
          this.foreignContext.push(true);
        } else if (htmlIntegrationElements.has(name2)) {
          this.foreignContext.push(false);
        }
      }
      (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, name2);
      if (this.cbs.onopentag)
        this.attribs = {};
    }
    endOpenTag(isImplied) {
      var _a2, _b;
      this.startIndex = this.openTagStart;
      if (this.attribs) {
        (_b = (_a2 = this.cbs).onopentag) === null || _b === void 0 ? void 0 : _b.call(_a2, this.tagname, this.attribs, isImplied);
        this.attribs = null;
      }
      if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
        this.cbs.onclosetag(this.tagname, true);
      }
      this.tagname = "";
    }
    /** @internal */
    onopentagend(endIndex) {
      this.endIndex = endIndex;
      this.endOpenTag(false);
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onclosetag(start, endIndex) {
      var _a2, _b, _c, _d, _e, _f;
      this.endIndex = endIndex;
      let name2 = this.getSlice(start, endIndex);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      if (foreignContextElements.has(name2) || htmlIntegrationElements.has(name2)) {
        this.foreignContext.pop();
      }
      if (!this.isVoidElement(name2)) {
        const pos = this.stack.lastIndexOf(name2);
        if (pos !== -1) {
          if (this.cbs.onclosetag) {
            let count = this.stack.length - pos;
            while (count--) {
              this.cbs.onclosetag(this.stack.pop(), count !== 0);
            }
          } else
            this.stack.length = pos;
        } else if (!this.options.xmlMode && name2 === "p") {
          this.emitOpenTag("p");
          this.closeCurrentTag(true);
        }
      } else if (!this.options.xmlMode && name2 === "br") {
        (_b = (_a2 = this.cbs).onopentagname) === null || _b === void 0 ? void 0 : _b.call(_a2, "br");
        (_d = (_c = this.cbs).onopentag) === null || _d === void 0 ? void 0 : _d.call(_c, "br", {}, true);
        (_f = (_e = this.cbs).onclosetag) === null || _f === void 0 ? void 0 : _f.call(_e, "br", false);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onselfclosingtag(endIndex) {
      this.endIndex = endIndex;
      if (this.options.xmlMode || this.options.recognizeSelfClosing || this.foreignContext[this.foreignContext.length - 1]) {
        this.closeCurrentTag(false);
        this.startIndex = endIndex + 1;
      } else {
        this.onopentagend(endIndex);
      }
    }
    closeCurrentTag(isOpenImplied) {
      var _a2, _b;
      const name2 = this.tagname;
      this.endOpenTag(isOpenImplied);
      if (this.stack[this.stack.length - 1] === name2) {
        (_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a2, name2, !isOpenImplied);
        this.stack.pop();
      }
    }
    /** @internal */
    onattribname(start, endIndex) {
      this.startIndex = start;
      const name2 = this.getSlice(start, endIndex);
      this.attribname = this.lowerCaseAttributeNames ? name2.toLowerCase() : name2;
    }
    /** @internal */
    onattribdata(start, endIndex) {
      this.attribvalue += this.getSlice(start, endIndex);
    }
    /** @internal */
    onattribentity(cp) {
      this.attribvalue += fromCodePoint$1(cp);
    }
    /** @internal */
    onattribend(quote, endIndex) {
      var _a2, _b;
      this.endIndex = endIndex;
      (_b = (_a2 = this.cbs).onattribute) === null || _b === void 0 ? void 0 : _b.call(_a2, this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? void 0 : null);
      if (this.attribs && !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)) {
        this.attribs[this.attribname] = this.attribvalue;
      }
      this.attribvalue = "";
    }
    getInstructionName(value) {
      const index2 = value.search(reNameEnd);
      let name2 = index2 < 0 ? value : value.substr(0, index2);
      if (this.lowerCaseTagNames) {
        name2 = name2.toLowerCase();
      }
      return name2;
    }
    /** @internal */
    ondeclaration(start, endIndex) {
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex);
      if (this.cbs.onprocessinginstruction) {
        const name2 = this.getInstructionName(value);
        this.cbs.onprocessinginstruction(`!${name2}`, `!${value}`);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onprocessinginstruction(start, endIndex) {
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex);
      if (this.cbs.onprocessinginstruction) {
        const name2 = this.getInstructionName(value);
        this.cbs.onprocessinginstruction(`?${name2}`, `?${value}`);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    oncomment(start, endIndex, offset) {
      var _a2, _b, _c, _d;
      this.endIndex = endIndex;
      (_b = (_a2 = this.cbs).oncomment) === null || _b === void 0 ? void 0 : _b.call(_a2, this.getSlice(start, endIndex - offset));
      (_d = (_c = this.cbs).oncommentend) === null || _d === void 0 ? void 0 : _d.call(_c);
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    oncdata(start, endIndex, offset) {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _j, _k;
      this.endIndex = endIndex;
      const value = this.getSlice(start, endIndex - offset);
      if (this.options.xmlMode || this.options.recognizeCDATA) {
        (_b = (_a2 = this.cbs).oncdatastart) === null || _b === void 0 ? void 0 : _b.call(_a2);
        (_d = (_c = this.cbs).ontext) === null || _d === void 0 ? void 0 : _d.call(_c, value);
        (_f = (_e = this.cbs).oncdataend) === null || _f === void 0 ? void 0 : _f.call(_e);
      } else {
        (_h = (_g = this.cbs).oncomment) === null || _h === void 0 ? void 0 : _h.call(_g, `[CDATA[${value}]]`);
        (_k = (_j = this.cbs).oncommentend) === null || _k === void 0 ? void 0 : _k.call(_j);
      }
      this.startIndex = endIndex + 1;
    }
    /** @internal */
    onend() {
      var _a2, _b;
      if (this.cbs.onclosetag) {
        this.endIndex = this.startIndex;
        for (let index2 = this.stack.length; index2 > 0; this.cbs.onclosetag(this.stack[--index2], true))
          ;
      }
      (_b = (_a2 = this.cbs).onend) === null || _b === void 0 ? void 0 : _b.call(_a2);
    }
    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */
    reset() {
      var _a2, _b, _c, _d;
      (_b = (_a2 = this.cbs).onreset) === null || _b === void 0 ? void 0 : _b.call(_a2);
      this.tokenizer.reset();
      this.tagname = "";
      this.attribname = "";
      this.attribs = null;
      this.stack.length = 0;
      this.startIndex = 0;
      this.endIndex = 0;
      (_d = (_c = this.cbs).onparserinit) === null || _d === void 0 ? void 0 : _d.call(_c, this);
      this.buffers.length = 0;
      this.bufferOffset = 0;
      this.writeIndex = 0;
      this.ended = false;
    }
    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     *
     * @param data Document to parse.
     */
    parseComplete(data2) {
      this.reset();
      this.end(data2);
    }
    getSlice(start, end2) {
      while (start - this.bufferOffset >= this.buffers[0].length) {
        this.shiftBuffer();
      }
      let slice2 = this.buffers[0].slice(start - this.bufferOffset, end2 - this.bufferOffset);
      while (end2 - this.bufferOffset > this.buffers[0].length) {
        this.shiftBuffer();
        slice2 += this.buffers[0].slice(0, end2 - this.bufferOffset);
      }
      return slice2;
    }
    shiftBuffer() {
      this.bufferOffset += this.buffers[0].length;
      this.writeIndex--;
      this.buffers.shift();
    }
    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     *
     * @param chunk Chunk to parse.
     */
    write(chunk) {
      var _a2, _b;
      if (this.ended) {
        (_b = (_a2 = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a2, new Error(".write() after done!"));
        return;
      }
      this.buffers.push(chunk);
      if (this.tokenizer.running) {
        this.tokenizer.write(chunk);
        this.writeIndex++;
      }
    }
    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     *
     * @param chunk Optional final chunk to parse.
     */
    end(chunk) {
      var _a2, _b;
      if (this.ended) {
        (_b = (_a2 = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a2, new Error(".end() after done!"));
        return;
      }
      if (chunk)
        this.write(chunk);
      this.ended = true;
      this.tokenizer.end();
    }
    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */
    pause() {
      this.tokenizer.pause();
    }
    /**
     * Resumes parsing after `pause` was called.
     */
    resume() {
      this.tokenizer.resume();
      while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
        this.tokenizer.write(this.buffers[this.writeIndex++]);
      }
      if (this.ended)
        this.tokenizer.end();
    }
    /**
     * Alias of `write`, for backwards compatibility.
     *
     * @param chunk Chunk to parse.
     * @deprecated
     */
    parseChunk(chunk) {
      this.write(chunk);
    }
    /**
     * Alias of `end`, for backwards compatibility.
     *
     * @param chunk Optional final chunk to parse.
     * @deprecated
     */
    done(chunk) {
      this.end(chunk);
    }
  }
  function parseDocument(data2, options) {
    const handler = new DomHandler(void 0, options);
    new Parser(handler, options).end(data2);
    return handler.root;
  }
  const parse = getParse((content, options, isDocument2, context) => options.xmlMode || options._useHtmlParser2 ? parseDocument(content, options) : parseWithParse5(content, options, isDocument2, context));
  const load$2 = getLoad(parse, (dom, options) => options.xmlMode || options._useHtmlParser2 ? render$1(dom, options) : renderWithParse5(dom));
  load$2([]);
  const defaultSelectorRules = {
    "div,p": ({ $node }) => ({
      queue: $node.children()
    }),
    "h1,h2,h3,h4,h5,h6": ({ $node, getContent }) => ({
      ...getContent($node.contents())
    }),
    "ul,ol": ({ $node }) => ({
      queue: $node.children(),
      nesting: true
    }),
    li: ({ $node, getContent }) => {
      const queue = $node.children().filter("ul,ol");
      let content;
      if ($node.contents().first().is("div,p")) {
        content = getContent($node.children().first());
      } else {
        let $contents = $node.contents();
        const i2 = $contents.index(queue);
        if (i2 >= 0)
          $contents = $contents.slice(0, i2);
        content = getContent($contents);
      }
      return {
        queue,
        nesting: true,
        ...content
      };
    },
    "table,pre,p>img:only-child": ({ $node, getContent }) => ({
      ...getContent($node)
    })
  };
  const defaultOptions = {
    selector: "h1,h2,h3,h4,h5,h6,ul,ol,li,table,pre,p>img:only-child",
    selectorRules: defaultSelectorRules
  };
  const MARKMAP_COMMENT_PREFIX = "markmap: ";
  const SELECTOR_HEADING = /^h[1-6]$/;
  const SELECTOR_LIST = /^[uo]l$/;
  const SELECTOR_LIST_ITEM = /^li$/;
  function getLevel(tagName) {
    if (SELECTOR_HEADING.test(tagName))
      return +tagName[1];
    if (SELECTOR_LIST.test(tagName))
      return 8;
    if (SELECTOR_LIST_ITEM.test(tagName))
      return 9;
    return 7;
  }
  function parseHtml(html2, opts) {
    const options = {
      ...defaultOptions,
      ...opts
    };
    const $2 = load$2(html2);
    const $root = $2("body");
    let id = 0;
    const rootNode = {
      id,
      tag: "",
      html: "",
      level: 0,
      parent: 0,
      childrenLevel: 0,
      children: []
    };
    const headingStack = [];
    let skippingHeading = 0;
    checkNodes($root.children());
    return rootNode;
    function addChild(props) {
      var _a2;
      const { parent: parent2 } = props;
      const node = {
        id: ++id,
        tag: props.tagName,
        level: props.level,
        html: props.html,
        childrenLevel: 0,
        children: props.nesting ? [] : void 0,
        parent: parent2.id
      };
      if ((_a2 = props.comments) == null ? void 0 : _a2.length) {
        node.comments = props.comments;
      }
      if (Object.keys(props.data || {}).length) {
        node.data = props.data;
      }
      if (parent2.children) {
        if (parent2.childrenLevel === 0 || parent2.childrenLevel > node.level) {
          parent2.children = [];
          parent2.childrenLevel = node.level;
        }
        if (parent2.childrenLevel === node.level) {
          parent2.children.push(node);
        }
      }
      return node;
    }
    function getCurrentHeading(level) {
      let heading2;
      while ((heading2 = headingStack.at(-1)) && heading2.level >= level) {
        headingStack.pop();
      }
      return heading2 || rootNode;
    }
    function getContent($node) {
      var _a2;
      const result = extractMagicComments($node);
      const html22 = (_a2 = $2.html(result.$node)) == null ? void 0 : _a2.trimEnd();
      return { comments: result.comments, html: html22 };
    }
    function extractMagicComments($node) {
      const comments = [];
      $node = $node.filter((_, child) => {
        if (child.type === "comment") {
          const data2 = child.data.trim();
          if (data2.startsWith(MARKMAP_COMMENT_PREFIX)) {
            comments.push(data2.slice(MARKMAP_COMMENT_PREFIX.length).trim());
            return false;
          }
        }
        return true;
      });
      return { $node, comments };
    }
    function checkNodes($els, node) {
      $els.each((_, child) => {
        var _a2;
        const $child = $2(child);
        const rule = (_a2 = Object.entries(options.selectorRules).find(
          ([selector]) => $child.is(selector)
        )) == null ? void 0 : _a2[1];
        const result = rule == null ? void 0 : rule({ $node: $child, $: $2, getContent });
        if ((result == null ? void 0 : result.queue) && !result.nesting) {
          checkNodes(result.queue, node);
          return;
        }
        const level = getLevel(child.tagName);
        if (!result) {
          if (level <= 6) {
            skippingHeading = level;
          }
          return;
        }
        if (skippingHeading > 0 && level > skippingHeading)
          return;
        if (!$child.is(options.selector))
          return;
        skippingHeading = 0;
        const isHeading = level <= 6;
        const childNode = addChild({
          parent: node || getCurrentHeading(level),
          nesting: !!result.queue || isHeading,
          tagName: child.tagName,
          level,
          html: result.html || "",
          comments: result.comments,
          data: $child.data()
        });
        if (isHeading)
          headingStack.push(childNode);
        if (result.queue)
          checkNodes(result.queue, childNode);
      });
    }
  }
  function convertNode(htmlRoot) {
    return walkTree(htmlRoot, (htmlNode, next2) => {
      const node = {
        content: htmlNode.html,
        children: next2() || []
      };
      if (htmlNode.data) {
        node.payload = {
          ...htmlNode.data
        };
      }
      if (htmlNode.comments) {
        if (htmlNode.comments.includes("foldAll")) {
          node.payload = { ...node.payload, fold: 2 };
        } else if (htmlNode.comments.includes("fold")) {
          node.payload = { ...node.payload, fold: 1 };
        }
      }
      return node;
    });
  }
  function buildTree(html2, opts) {
    const htmlRoot = parseHtml(html2, opts);
    return convertNode(htmlRoot);
  }
  var textarea;
  function decodeEntity(name2) {
    textarea = textarea || document.createElement("textarea");
    textarea.innerHTML = "&" + name2 + ";";
    return textarea.value;
  }
  var hasOwn = Object.prototype.hasOwnProperty;
  function has(object, key) {
    return object ? hasOwn.call(object, key) : false;
  }
  function assign(obj) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function(source) {
      if (!source) {
        return;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be object");
      }
      Object.keys(source).forEach(function(key) {
        obj[key] = source[key];
      });
    });
    return obj;
  }
  var UNESCAPE_MD_RE = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
  function unescapeMd(str2) {
    if (str2.indexOf("\\") < 0) {
      return str2;
    }
    return str2.replace(UNESCAPE_MD_RE, "$1");
  }
  function isValidEntityCode(c) {
    if (c >= 55296 && c <= 57343) {
      return false;
    }
    if (c >= 64976 && c <= 65007) {
      return false;
    }
    if ((c & 65535) === 65535 || (c & 65535) === 65534) {
      return false;
    }
    if (c >= 0 && c <= 8) {
      return false;
    }
    if (c === 11) {
      return false;
    }
    if (c >= 14 && c <= 31) {
      return false;
    }
    if (c >= 127 && c <= 159) {
      return false;
    }
    if (c > 1114111) {
      return false;
    }
    return true;
  }
  function fromCodePoint(c) {
    if (c > 65535) {
      c -= 65536;
      var surrogate1 = 55296 + (c >> 10), surrogate2 = 56320 + (c & 1023);
      return String.fromCharCode(surrogate1, surrogate2);
    }
    return String.fromCharCode(c);
  }
  var NAMED_ENTITY_RE = /&([a-z#][a-z0-9]{1,31});/gi;
  var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;
  function replaceEntityPattern(match, name2) {
    var code2 = 0;
    var decoded = decodeEntity(name2);
    if (name2 !== decoded) {
      return decoded;
    } else if (name2.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name2)) {
      code2 = name2[1].toLowerCase() === "x" ? parseInt(name2.slice(2), 16) : parseInt(name2.slice(1), 10);
      if (isValidEntityCode(code2)) {
        return fromCodePoint(code2);
      }
    }
    return match;
  }
  function replaceEntities(str2) {
    if (str2.indexOf("&") < 0) {
      return str2;
    }
    return str2.replace(NAMED_ENTITY_RE, replaceEntityPattern);
  }
  var HTML_ESCAPE_TEST_RE = /[&<>"]/;
  var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
  var HTML_REPLACEMENTS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  };
  function replaceUnsafeChar(ch) {
    return HTML_REPLACEMENTS[ch];
  }
  function escapeHtml(str2) {
    if (HTML_ESCAPE_TEST_RE.test(str2)) {
      return str2.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
    }
    return str2;
  }
  var rules = {};
  rules.blockquote_open = function() {
    return "<blockquote>\n";
  };
  rules.blockquote_close = function(tokens, idx) {
    return "</blockquote>" + getBreak(tokens, idx);
  };
  rules.code = function(tokens, idx) {
    if (tokens[idx].block) {
      return "<pre><code>" + escapeHtml(tokens[idx].content) + "</code></pre>" + getBreak(tokens, idx);
    }
    return "<code>" + escapeHtml(tokens[idx].content) + "</code>";
  };
  rules.fence = function(tokens, idx, options, env, instance) {
    var token = tokens[idx];
    var langClass = "";
    var langPrefix = options.langPrefix;
    var langName = "", fences2, fenceName;
    var highlighted;
    if (token.params) {
      fences2 = token.params.split(/\s+/g);
      fenceName = fences2.join(" ");
      if (has(instance.rules.fence_custom, fences2[0])) {
        return instance.rules.fence_custom[fences2[0]](tokens, idx, options, env, instance);
      }
      langName = escapeHtml(replaceEntities(unescapeMd(fenceName)));
      langClass = ' class="' + langPrefix + langName + '"';
    }
    if (options.highlight) {
      highlighted = options.highlight.apply(options.highlight, [token.content].concat(fences2)) || escapeHtml(token.content);
    } else {
      highlighted = escapeHtml(token.content);
    }
    return "<pre><code" + langClass + ">" + highlighted + "</code></pre>" + getBreak(tokens, idx);
  };
  rules.fence_custom = {};
  rules.heading_open = function(tokens, idx) {
    return "<h" + tokens[idx].hLevel + ">";
  };
  rules.heading_close = function(tokens, idx) {
    return "</h" + tokens[idx].hLevel + ">\n";
  };
  rules.hr = function(tokens, idx, options) {
    return (options.xhtmlOut ? "<hr />" : "<hr>") + getBreak(tokens, idx);
  };
  rules.bullet_list_open = function() {
    return "<ul>\n";
  };
  rules.bullet_list_close = function(tokens, idx) {
    return "</ul>" + getBreak(tokens, idx);
  };
  rules.list_item_open = function() {
    return "<li>";
  };
  rules.list_item_close = function() {
    return "</li>\n";
  };
  rules.ordered_list_open = function(tokens, idx) {
    var token = tokens[idx];
    var order = token.order > 1 ? ' start="' + token.order + '"' : "";
    return "<ol" + order + ">\n";
  };
  rules.ordered_list_close = function(tokens, idx) {
    return "</ol>" + getBreak(tokens, idx);
  };
  rules.paragraph_open = function(tokens, idx) {
    return tokens[idx].tight ? "" : "<p>";
  };
  rules.paragraph_close = function(tokens, idx) {
    var addBreak = !(tokens[idx].tight && idx && tokens[idx - 1].type === "inline" && !tokens[idx - 1].content);
    return (tokens[idx].tight ? "" : "</p>") + (addBreak ? getBreak(tokens, idx) : "");
  };
  rules.link_open = function(tokens, idx, options) {
    var title = tokens[idx].title ? ' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"' : "";
    var target = options.linkTarget ? ' target="' + options.linkTarget + '"' : "";
    return '<a href="' + escapeHtml(tokens[idx].href) + '"' + title + target + ">";
  };
  rules.link_close = function() {
    return "</a>";
  };
  rules.image = function(tokens, idx, options) {
    var src = ' src="' + escapeHtml(tokens[idx].src) + '"';
    var title = tokens[idx].title ? ' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"' : "";
    var alt = ' alt="' + (tokens[idx].alt ? escapeHtml(replaceEntities(unescapeMd(tokens[idx].alt))) : "") + '"';
    var suffix = options.xhtmlOut ? " /" : "";
    return "<img" + src + alt + title + suffix + ">";
  };
  rules.table_open = function() {
    return "<table>\n";
  };
  rules.table_close = function() {
    return "</table>\n";
  };
  rules.thead_open = function() {
    return "<thead>\n";
  };
  rules.thead_close = function() {
    return "</thead>\n";
  };
  rules.tbody_open = function() {
    return "<tbody>\n";
  };
  rules.tbody_close = function() {
    return "</tbody>\n";
  };
  rules.tr_open = function() {
    return "<tr>";
  };
  rules.tr_close = function() {
    return "</tr>\n";
  };
  rules.th_open = function(tokens, idx) {
    var token = tokens[idx];
    return "<th" + (token.align ? ' style="text-align:' + token.align + '"' : "") + ">";
  };
  rules.th_close = function() {
    return "</th>";
  };
  rules.td_open = function(tokens, idx) {
    var token = tokens[idx];
    return "<td" + (token.align ? ' style="text-align:' + token.align + '"' : "") + ">";
  };
  rules.td_close = function() {
    return "</td>";
  };
  rules.strong_open = function() {
    return "<strong>";
  };
  rules.strong_close = function() {
    return "</strong>";
  };
  rules.em_open = function() {
    return "<em>";
  };
  rules.em_close = function() {
    return "</em>";
  };
  rules.del_open = function() {
    return "<del>";
  };
  rules.del_close = function() {
    return "</del>";
  };
  rules.ins_open = function() {
    return "<ins>";
  };
  rules.ins_close = function() {
    return "</ins>";
  };
  rules.mark_open = function() {
    return "<mark>";
  };
  rules.mark_close = function() {
    return "</mark>";
  };
  rules.sub = function(tokens, idx) {
    return "<sub>" + escapeHtml(tokens[idx].content) + "</sub>";
  };
  rules.sup = function(tokens, idx) {
    return "<sup>" + escapeHtml(tokens[idx].content) + "</sup>";
  };
  rules.hardbreak = function(tokens, idx, options) {
    return options.xhtmlOut ? "<br />\n" : "<br>\n";
  };
  rules.softbreak = function(tokens, idx, options) {
    return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
  };
  rules.text = function(tokens, idx) {
    return escapeHtml(tokens[idx].content);
  };
  rules.htmlblock = function(tokens, idx) {
    return tokens[idx].content;
  };
  rules.htmltag = function(tokens, idx) {
    return tokens[idx].content;
  };
  rules.abbr_open = function(tokens, idx) {
    return '<abbr title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '">';
  };
  rules.abbr_close = function() {
    return "</abbr>";
  };
  rules.footnote_ref = function(tokens, idx) {
    var n = Number(tokens[idx].id + 1).toString();
    var id = "fnref" + n;
    if (tokens[idx].subId > 0) {
      id += ":" + tokens[idx].subId;
    }
    return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">[' + n + "]</a></sup>";
  };
  rules.footnote_block_open = function(tokens, idx, options) {
    var hr2 = options.xhtmlOut ? '<hr class="footnotes-sep" />\n' : '<hr class="footnotes-sep">\n';
    return hr2 + '<section class="footnotes">\n<ol class="footnotes-list">\n';
  };
  rules.footnote_block_close = function() {
    return "</ol>\n</section>\n";
  };
  rules.footnote_open = function(tokens, idx) {
    var id = Number(tokens[idx].id + 1).toString();
    return '<li id="fn' + id + '"  class="footnote-item">';
  };
  rules.footnote_close = function() {
    return "</li>\n";
  };
  rules.footnote_anchor = function(tokens, idx) {
    var n = Number(tokens[idx].id + 1).toString();
    var id = "fnref" + n;
    if (tokens[idx].subId > 0) {
      id += ":" + tokens[idx].subId;
    }
    return ' <a href="#' + id + '" class="footnote-backref">↩</a>';
  };
  rules.dl_open = function() {
    return "<dl>\n";
  };
  rules.dt_open = function() {
    return "<dt>";
  };
  rules.dd_open = function() {
    return "<dd>";
  };
  rules.dl_close = function() {
    return "</dl>\n";
  };
  rules.dt_close = function() {
    return "</dt>\n";
  };
  rules.dd_close = function() {
    return "</dd>\n";
  };
  function nextToken(tokens, idx) {
    if (++idx >= tokens.length - 2) {
      return idx;
    }
    if (tokens[idx].type === "paragraph_open" && tokens[idx].tight && (tokens[idx + 1].type === "inline" && tokens[idx + 1].content.length === 0) && (tokens[idx + 2].type === "paragraph_close" && tokens[idx + 2].tight)) {
      return nextToken(tokens, idx + 2);
    }
    return idx;
  }
  var getBreak = rules.getBreak = function getBreak2(tokens, idx) {
    idx = nextToken(tokens, idx);
    if (idx < tokens.length && tokens[idx].type === "list_item_close") {
      return "";
    }
    return "\n";
  };
  function Renderer() {
    this.rules = assign({}, rules);
    this.getBreak = rules.getBreak;
  }
  Renderer.prototype.renderInline = function(tokens, options, env) {
    var _rules2 = this.rules;
    var len = tokens.length, i2 = 0;
    var result = "";
    while (len--) {
      result += _rules2[tokens[i2].type](tokens, i2++, options, env, this);
    }
    return result;
  };
  Renderer.prototype.render = function(tokens, options, env) {
    var _rules2 = this.rules;
    var len = tokens.length, i2 = -1;
    var result = "";
    while (++i2 < len) {
      if (tokens[i2].type === "inline") {
        result += this.renderInline(tokens[i2].children, options, env);
      } else {
        result += _rules2[tokens[i2].type](tokens, i2, options, env, this);
      }
    }
    return result;
  };
  function Ruler() {
    this.__rules__ = [];
    this.__cache__ = null;
  }
  Ruler.prototype.__find__ = function(name2) {
    var len = this.__rules__.length;
    var i2 = -1;
    while (len--) {
      if (this.__rules__[++i2].name === name2) {
        return i2;
      }
    }
    return -1;
  };
  Ruler.prototype.__compile__ = function() {
    var self = this;
    var chains = [""];
    self.__rules__.forEach(function(rule) {
      if (!rule.enabled) {
        return;
      }
      rule.alt.forEach(function(altName) {
        if (chains.indexOf(altName) < 0) {
          chains.push(altName);
        }
      });
    });
    self.__cache__ = {};
    chains.forEach(function(chain) {
      self.__cache__[chain] = [];
      self.__rules__.forEach(function(rule) {
        if (!rule.enabled) {
          return;
        }
        if (chain && rule.alt.indexOf(chain) < 0) {
          return;
        }
        self.__cache__[chain].push(rule.fn);
      });
    });
  };
  Ruler.prototype.at = function(name2, fn, options) {
    var idx = this.__find__(name2);
    var opt = options || {};
    if (idx === -1) {
      throw new Error("Parser rule not found: " + name2);
    }
    this.__rules__[idx].fn = fn;
    this.__rules__[idx].alt = opt.alt || [];
    this.__cache__ = null;
  };
  Ruler.prototype.before = function(beforeName, ruleName, fn, options) {
    var idx = this.__find__(beforeName);
    var opt = options || {};
    if (idx === -1) {
      throw new Error("Parser rule not found: " + beforeName);
    }
    this.__rules__.splice(idx, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.after = function(afterName, ruleName, fn, options) {
    var idx = this.__find__(afterName);
    var opt = options || {};
    if (idx === -1) {
      throw new Error("Parser rule not found: " + afterName);
    }
    this.__rules__.splice(idx + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.push = function(ruleName, fn, options) {
    var opt = options || {};
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: opt.alt || []
    });
    this.__cache__ = null;
  };
  Ruler.prototype.enable = function(list2, strict) {
    list2 = !Array.isArray(list2) ? [list2] : list2;
    if (strict) {
      this.__rules__.forEach(function(rule) {
        rule.enabled = false;
      });
    }
    list2.forEach(function(name2) {
      var idx = this.__find__(name2);
      if (idx < 0) {
        throw new Error("Rules manager: invalid rule name " + name2);
      }
      this.__rules__[idx].enabled = true;
    }, this);
    this.__cache__ = null;
  };
  Ruler.prototype.disable = function(list2) {
    list2 = !Array.isArray(list2) ? [list2] : list2;
    list2.forEach(function(name2) {
      var idx = this.__find__(name2);
      if (idx < 0) {
        throw new Error("Rules manager: invalid rule name " + name2);
      }
      this.__rules__[idx].enabled = false;
    }, this);
    this.__cache__ = null;
  };
  Ruler.prototype.getRules = function(chainName) {
    if (this.__cache__ === null) {
      this.__compile__();
    }
    return this.__cache__[chainName] || [];
  };
  function block(state) {
    if (state.inlineMode) {
      state.tokens.push({
        type: "inline",
        content: state.src.replace(/\n/g, " ").trim(),
        level: 0,
        lines: [0, 1],
        children: []
      });
    } else {
      state.block.parse(state.src, state.options, state.env, state.tokens);
    }
  }
  function StateInline(src, parserInline, options, env, outTokens) {
    this.src = src;
    this.env = env;
    this.options = options;
    this.parser = parserInline;
    this.tokens = outTokens;
    this.pos = 0;
    this.posMax = this.src.length;
    this.level = 0;
    this.pending = "";
    this.pendingLevel = 0;
    this.cache = [];
    this.isInLabel = false;
    this.linkLevel = 0;
    this.linkContent = "";
    this.labelUnmatchedScopes = 0;
  }
  StateInline.prototype.pushPending = function() {
    this.tokens.push({
      type: "text",
      content: this.pending,
      level: this.pendingLevel
    });
    this.pending = "";
  };
  StateInline.prototype.push = function(token) {
    if (this.pending) {
      this.pushPending();
    }
    this.tokens.push(token);
    this.pendingLevel = this.level;
  };
  StateInline.prototype.cacheSet = function(key, val2) {
    for (var i2 = this.cache.length; i2 <= key; i2++) {
      this.cache.push(0);
    }
    this.cache[key] = val2;
  };
  StateInline.prototype.cacheGet = function(key) {
    return key < this.cache.length ? this.cache[key] : 0;
  };
  function parseLinkLabel(state, start) {
    var level, found, marker, labelEnd = -1, max = state.posMax, oldPos = state.pos, oldFlag = state.isInLabel;
    if (state.isInLabel) {
      return -1;
    }
    if (state.labelUnmatchedScopes) {
      state.labelUnmatchedScopes--;
      return -1;
    }
    state.pos = start + 1;
    state.isInLabel = true;
    level = 1;
    while (state.pos < max) {
      marker = state.src.charCodeAt(state.pos);
      if (marker === 91) {
        level++;
      } else if (marker === 93) {
        level--;
        if (level === 0) {
          found = true;
          break;
        }
      }
      state.parser.skipToken(state);
    }
    if (found) {
      labelEnd = state.pos;
      state.labelUnmatchedScopes = 0;
    } else {
      state.labelUnmatchedScopes = level - 1;
    }
    state.pos = oldPos;
    state.isInLabel = oldFlag;
    return labelEnd;
  }
  function parseAbbr(str2, parserInline, options, env) {
    var state, labelEnd, pos, max, label, title;
    if (str2.charCodeAt(0) !== 42) {
      return -1;
    }
    if (str2.charCodeAt(1) !== 91) {
      return -1;
    }
    if (str2.indexOf("]:") === -1) {
      return -1;
    }
    state = new StateInline(str2, parserInline, options, env, []);
    labelEnd = parseLinkLabel(state, 1);
    if (labelEnd < 0 || str2.charCodeAt(labelEnd + 1) !== 58) {
      return -1;
    }
    max = state.posMax;
    for (pos = labelEnd + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 10) {
        break;
      }
    }
    label = str2.slice(2, labelEnd);
    title = str2.slice(labelEnd + 2, pos).trim();
    if (title.length === 0) {
      return -1;
    }
    if (!env.abbreviations) {
      env.abbreviations = {};
    }
    if (typeof env.abbreviations[":" + label] === "undefined") {
      env.abbreviations[":" + label] = title;
    }
    return pos;
  }
  function abbr(state) {
    var tokens = state.tokens, i2, l, content, pos;
    if (state.inlineMode) {
      return;
    }
    for (i2 = 1, l = tokens.length - 1; i2 < l; i2++) {
      if (tokens[i2 - 1].type === "paragraph_open" && tokens[i2].type === "inline" && tokens[i2 + 1].type === "paragraph_close") {
        content = tokens[i2].content;
        while (content.length) {
          pos = parseAbbr(content, state.inline, state.options, state.env);
          if (pos < 0) {
            break;
          }
          content = content.slice(pos).trim();
        }
        tokens[i2].content = content;
        if (!content.length) {
          tokens[i2 - 1].tight = true;
          tokens[i2 + 1].tight = true;
        }
      }
    }
  }
  function normalizeLink(url) {
    var normalized = replaceEntities(url);
    try {
      normalized = decodeURI(normalized);
    } catch (err) {
    }
    return encodeURI(normalized);
  }
  function parseLinkDestination(state, pos) {
    var code2, level, link, start = pos, max = state.posMax;
    if (state.src.charCodeAt(pos) === 60) {
      pos++;
      while (pos < max) {
        code2 = state.src.charCodeAt(pos);
        if (code2 === 10) {
          return false;
        }
        if (code2 === 62) {
          link = normalizeLink(unescapeMd(state.src.slice(start + 1, pos)));
          if (!state.parser.validateLink(link)) {
            return false;
          }
          state.pos = pos + 1;
          state.linkContent = link;
          return true;
        }
        if (code2 === 92 && pos + 1 < max) {
          pos += 2;
          continue;
        }
        pos++;
      }
      return false;
    }
    level = 0;
    while (pos < max) {
      code2 = state.src.charCodeAt(pos);
      if (code2 === 32) {
        break;
      }
      if (code2 < 32 || code2 === 127) {
        break;
      }
      if (code2 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      if (code2 === 40) {
        level++;
        if (level > 1) {
          break;
        }
      }
      if (code2 === 41) {
        level--;
        if (level < 0) {
          break;
        }
      }
      pos++;
    }
    if (start === pos) {
      return false;
    }
    link = unescapeMd(state.src.slice(start, pos));
    if (!state.parser.validateLink(link)) {
      return false;
    }
    state.linkContent = link;
    state.pos = pos;
    return true;
  }
  function parseLinkTitle(state, pos) {
    var code2, start = pos, max = state.posMax, marker = state.src.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40) {
      return false;
    }
    pos++;
    if (marker === 40) {
      marker = 41;
    }
    while (pos < max) {
      code2 = state.src.charCodeAt(pos);
      if (code2 === marker) {
        state.pos = pos + 1;
        state.linkContent = unescapeMd(state.src.slice(start + 1, pos));
        return true;
      }
      if (code2 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return false;
  }
  function normalizeReference(str2) {
    return str2.trim().replace(/\s+/g, " ").toUpperCase();
  }
  function parseReference(str2, parser, options, env) {
    var state, labelEnd, pos, max, code2, start, href, title, label;
    if (str2.charCodeAt(0) !== 91) {
      return -1;
    }
    if (str2.indexOf("]:") === -1) {
      return -1;
    }
    state = new StateInline(str2, parser, options, env, []);
    labelEnd = parseLinkLabel(state, 0);
    if (labelEnd < 0 || str2.charCodeAt(labelEnd + 1) !== 58) {
      return -1;
    }
    max = state.posMax;
    for (pos = labelEnd + 2; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (code2 !== 32 && code2 !== 10) {
        break;
      }
    }
    if (!parseLinkDestination(state, pos)) {
      return -1;
    }
    href = state.linkContent;
    pos = state.pos;
    start = pos;
    for (pos = pos + 1; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (code2 !== 32 && code2 !== 10) {
        break;
      }
    }
    if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
      title = state.linkContent;
      pos = state.pos;
    } else {
      title = "";
      pos = start;
    }
    while (pos < max && state.src.charCodeAt(pos) === 32) {
      pos++;
    }
    if (pos < max && state.src.charCodeAt(pos) !== 10) {
      return -1;
    }
    label = normalizeReference(str2.slice(1, labelEnd));
    if (typeof env.references[label] === "undefined") {
      env.references[label] = { title, href };
    }
    return pos;
  }
  function references(state) {
    var tokens = state.tokens, i2, l, content, pos;
    state.env.references = state.env.references || {};
    if (state.inlineMode) {
      return;
    }
    for (i2 = 1, l = tokens.length - 1; i2 < l; i2++) {
      if (tokens[i2].type === "inline" && tokens[i2 - 1].type === "paragraph_open" && tokens[i2 + 1].type === "paragraph_close") {
        content = tokens[i2].content;
        while (content.length) {
          pos = parseReference(content, state.inline, state.options, state.env);
          if (pos < 0) {
            break;
          }
          content = content.slice(pos).trim();
        }
        tokens[i2].content = content;
        if (!content.length) {
          tokens[i2 - 1].tight = true;
          tokens[i2 + 1].tight = true;
        }
      }
    }
  }
  function inline(state) {
    var tokens = state.tokens, tok, i2, l;
    for (i2 = 0, l = tokens.length; i2 < l; i2++) {
      tok = tokens[i2];
      if (tok.type === "inline") {
        state.inline.parse(tok.content, state.options, state.env, tok.children);
      }
    }
  }
  function footnote_block(state) {
    var i2, l, j, t, lastParagraph, list2, tokens, current, currentLabel, level = 0, insideRef = false, refTokens = {};
    if (!state.env.footnotes) {
      return;
    }
    state.tokens = state.tokens.filter(function(tok) {
      if (tok.type === "footnote_reference_open") {
        insideRef = true;
        current = [];
        currentLabel = tok.label;
        return false;
      }
      if (tok.type === "footnote_reference_close") {
        insideRef = false;
        refTokens[":" + currentLabel] = current;
        return false;
      }
      if (insideRef) {
        current.push(tok);
      }
      return !insideRef;
    });
    if (!state.env.footnotes.list) {
      return;
    }
    list2 = state.env.footnotes.list;
    state.tokens.push({
      type: "footnote_block_open",
      level: level++
    });
    for (i2 = 0, l = list2.length; i2 < l; i2++) {
      state.tokens.push({
        type: "footnote_open",
        id: i2,
        level: level++
      });
      if (list2[i2].tokens) {
        tokens = [];
        tokens.push({
          type: "paragraph_open",
          tight: false,
          level: level++
        });
        tokens.push({
          type: "inline",
          content: "",
          level,
          children: list2[i2].tokens
        });
        tokens.push({
          type: "paragraph_close",
          tight: false,
          level: --level
        });
      } else if (list2[i2].label) {
        tokens = refTokens[":" + list2[i2].label];
      }
      state.tokens = state.tokens.concat(tokens);
      if (state.tokens[state.tokens.length - 1].type === "paragraph_close") {
        lastParagraph = state.tokens.pop();
      } else {
        lastParagraph = null;
      }
      t = list2[i2].count > 0 ? list2[i2].count : 1;
      for (j = 0; j < t; j++) {
        state.tokens.push({
          type: "footnote_anchor",
          id: i2,
          subId: j,
          level
        });
      }
      if (lastParagraph) {
        state.tokens.push(lastParagraph);
      }
      state.tokens.push({
        type: "footnote_close",
        level: --level
      });
    }
    state.tokens.push({
      type: "footnote_block_close",
      level: --level
    });
  }
  var PUNCT_CHARS = ` 
()[]'".,!?-`;
  function regEscape(s) {
    return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, "\\$1");
  }
  function abbr2(state) {
    var i2, j, l, tokens, token, text2, nodes, pos, level, reg, m, regText, blockTokens = state.tokens;
    if (!state.env.abbreviations) {
      return;
    }
    if (!state.env.abbrRegExp) {
      regText = "(^|[" + PUNCT_CHARS.split("").map(regEscape).join("") + "])(" + Object.keys(state.env.abbreviations).map(function(x) {
        return x.substr(1);
      }).sort(function(a, b) {
        return b.length - a.length;
      }).map(regEscape).join("|") + ")($|[" + PUNCT_CHARS.split("").map(regEscape).join("") + "])";
      state.env.abbrRegExp = new RegExp(regText, "g");
    }
    reg = state.env.abbrRegExp;
    for (j = 0, l = blockTokens.length; j < l; j++) {
      if (blockTokens[j].type !== "inline") {
        continue;
      }
      tokens = blockTokens[j].children;
      for (i2 = tokens.length - 1; i2 >= 0; i2--) {
        token = tokens[i2];
        if (token.type !== "text") {
          continue;
        }
        pos = 0;
        text2 = token.content;
        reg.lastIndex = 0;
        level = token.level;
        nodes = [];
        while (m = reg.exec(text2)) {
          if (reg.lastIndex > pos) {
            nodes.push({
              type: "text",
              content: text2.slice(pos, m.index + m[1].length),
              level
            });
          }
          nodes.push({
            type: "abbr_open",
            title: state.env.abbreviations[":" + m[2]],
            level: level++
          });
          nodes.push({
            type: "text",
            content: m[2],
            level
          });
          nodes.push({
            type: "abbr_close",
            level: --level
          });
          pos = reg.lastIndex - m[3].length;
        }
        if (!nodes.length) {
          continue;
        }
        if (pos < text2.length) {
          nodes.push({
            type: "text",
            content: text2.slice(pos),
            level
          });
        }
        blockTokens[j].children = tokens = [].concat(tokens.slice(0, i2), nodes, tokens.slice(i2 + 1));
      }
    }
  }
  var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
  var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
  var SCOPED_ABBR = {
    "c": "©",
    "r": "®",
    "p": "§",
    "tm": "™"
  };
  function replaceScopedAbbr(str2) {
    if (str2.indexOf("(") < 0) {
      return str2;
    }
    return str2.replace(SCOPED_ABBR_RE, function(match, name2) {
      return SCOPED_ABBR[name2.toLowerCase()];
    });
  }
  function replace(state) {
    var i2, token, text2, inlineTokens, blkIdx;
    if (!state.options.typographer) {
      return;
    }
    for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== "inline") {
        continue;
      }
      inlineTokens = state.tokens[blkIdx].children;
      for (i2 = inlineTokens.length - 1; i2 >= 0; i2--) {
        token = inlineTokens[i2];
        if (token.type === "text") {
          text2 = token.content;
          text2 = replaceScopedAbbr(text2);
          if (RARE_RE.test(text2)) {
            text2 = text2.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---([^-]|$)/mg, "$1—$2").replace(/(^|\s)--(\s|$)/mg, "$1–$2").replace(/(^|[^-\s])--([^-\s]|$)/mg, "$1–$2");
          }
          token.content = text2;
        }
      }
    }
  }
  var QUOTE_TEST_RE = /['"]/;
  var QUOTE_RE = /['"]/g;
  var PUNCT_RE = /[-\s()\[\]]/;
  var APOSTROPHE = "’";
  function isLetter(str2, pos) {
    if (pos < 0 || pos >= str2.length) {
      return false;
    }
    return !PUNCT_RE.test(str2[pos]);
  }
  function replaceAt(str2, index2, ch) {
    return str2.substr(0, index2) + ch + str2.substr(index2 + 1);
  }
  function smartquotes(state) {
    var i2, token, text2, t, pos, max, thisLevel, lastSpace, nextSpace, item, canOpen, canClose, j, isSingle, blkIdx, tokens, stack;
    if (!state.options.typographer) {
      return;
    }
    stack = [];
    for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
      if (state.tokens[blkIdx].type !== "inline") {
        continue;
      }
      tokens = state.tokens[blkIdx].children;
      stack.length = 0;
      for (i2 = 0; i2 < tokens.length; i2++) {
        token = tokens[i2];
        if (token.type !== "text" || QUOTE_TEST_RE.test(token.text)) {
          continue;
        }
        thisLevel = tokens[i2].level;
        for (j = stack.length - 1; j >= 0; j--) {
          if (stack[j].level <= thisLevel) {
            break;
          }
        }
        stack.length = j + 1;
        text2 = token.content;
        pos = 0;
        max = text2.length;
        OUTER:
          while (pos < max) {
            QUOTE_RE.lastIndex = pos;
            t = QUOTE_RE.exec(text2);
            if (!t) {
              break;
            }
            lastSpace = !isLetter(text2, t.index - 1);
            pos = t.index + 1;
            isSingle = t[0] === "'";
            nextSpace = !isLetter(text2, pos);
            if (!nextSpace && !lastSpace) {
              if (isSingle) {
                token.content = replaceAt(token.content, t.index, APOSTROPHE);
              }
              continue;
            }
            canOpen = !nextSpace;
            canClose = !lastSpace;
            if (canClose) {
              for (j = stack.length - 1; j >= 0; j--) {
                item = stack[j];
                if (stack[j].level < thisLevel) {
                  break;
                }
                if (item.single === isSingle && stack[j].level === thisLevel) {
                  item = stack[j];
                  if (isSingle) {
                    tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[2]);
                    token.content = replaceAt(token.content, t.index, state.options.quotes[3]);
                  } else {
                    tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[0]);
                    token.content = replaceAt(token.content, t.index, state.options.quotes[1]);
                  }
                  stack.length = j;
                  continue OUTER;
                }
              }
            }
            if (canOpen) {
              stack.push({
                token: i2,
                pos: t.index,
                single: isSingle,
                level: thisLevel
              });
            } else if (canClose && isSingle) {
              token.content = replaceAt(token.content, t.index, APOSTROPHE);
            }
          }
      }
    }
  }
  var _rules = [
    ["block", block],
    ["abbr", abbr],
    ["references", references],
    ["inline", inline],
    ["footnote_tail", footnote_block],
    ["abbr2", abbr2],
    ["replacements", replace],
    ["smartquotes", smartquotes]
  ];
  function Core() {
    this.options = {};
    this.ruler = new Ruler();
    for (var i2 = 0; i2 < _rules.length; i2++) {
      this.ruler.push(_rules[i2][0], _rules[i2][1]);
    }
  }
  Core.prototype.process = function(state) {
    var i2, l, rules2;
    rules2 = this.ruler.getRules("");
    for (i2 = 0, l = rules2.length; i2 < l; i2++) {
      rules2[i2](state);
    }
  };
  function StateBlock(src, parser, options, env, tokens) {
    var ch, s, start, pos, len, indent, indent_found;
    this.src = src;
    this.parser = parser;
    this.options = options;
    this.env = env;
    this.tokens = tokens;
    this.bMarks = [];
    this.eMarks = [];
    this.tShift = [];
    this.blkIndent = 0;
    this.line = 0;
    this.lineMax = 0;
    this.tight = false;
    this.parentType = "root";
    this.ddIndent = -1;
    this.level = 0;
    this.result = "";
    s = this.src;
    indent = 0;
    indent_found = false;
    for (start = pos = indent = 0, len = s.length; pos < len; pos++) {
      ch = s.charCodeAt(pos);
      if (!indent_found) {
        if (ch === 32) {
          indent++;
          continue;
        } else {
          indent_found = true;
        }
      }
      if (ch === 10 || pos === len - 1) {
        if (ch !== 10) {
          pos++;
        }
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        indent_found = false;
        indent = 0;
        start = pos + 1;
      }
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  StateBlock.prototype.isEmpty = function isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  };
  StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
    for (var max = this.lineMax; from < max; from++) {
      if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
        break;
      }
    }
    return from;
  };
  StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
    for (var max = this.src.length; pos < max; pos++) {
      if (this.src.charCodeAt(pos) !== 32) {
        break;
      }
    }
    return pos;
  };
  StateBlock.prototype.skipChars = function skipChars(pos, code2) {
    for (var max = this.src.length; pos < max; pos++) {
      if (this.src.charCodeAt(pos) !== code2) {
        break;
      }
    }
    return pos;
  };
  StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code2, min) {
    if (pos <= min) {
      return pos;
    }
    while (pos > min) {
      if (code2 !== this.src.charCodeAt(--pos)) {
        return pos + 1;
      }
    }
    return pos;
  };
  StateBlock.prototype.getLines = function getLines(begin, end2, indent, keepLastLF) {
    var i2, first2, last2, queue, shift, line = begin;
    if (begin >= end2) {
      return "";
    }
    if (line + 1 === end2) {
      first2 = this.bMarks[line] + Math.min(this.tShift[line], indent);
      last2 = keepLastLF ? this.eMarks[line] + 1 : this.eMarks[line];
      return this.src.slice(first2, last2);
    }
    queue = new Array(end2 - begin);
    for (i2 = 0; line < end2; line++, i2++) {
      shift = this.tShift[line];
      if (shift > indent) {
        shift = indent;
      }
      if (shift < 0) {
        shift = 0;
      }
      first2 = this.bMarks[line] + shift;
      if (line + 1 < end2 || keepLastLF) {
        last2 = this.eMarks[line] + 1;
      } else {
        last2 = this.eMarks[line];
      }
      queue[i2] = this.src.slice(first2, last2);
    }
    return queue.join("");
  };
  function code(state, startLine, endLine) {
    var nextLine, last2;
    if (state.tShift[startLine] - state.blkIndent < 4) {
      return false;
    }
    last2 = nextLine = startLine + 1;
    while (nextLine < endLine) {
      if (state.isEmpty(nextLine)) {
        nextLine++;
        continue;
      }
      if (state.tShift[nextLine] - state.blkIndent >= 4) {
        nextLine++;
        last2 = nextLine;
        continue;
      }
      break;
    }
    state.line = nextLine;
    state.tokens.push({
      type: "code",
      content: state.getLines(startLine, last2, 4 + state.blkIndent, true),
      block: true,
      lines: [startLine, state.line],
      level: state.level
    });
    return true;
  }
  function fences(state, startLine, endLine, silent) {
    var marker, len, params, nextLine, mem, haveEndMarker = false, pos = state.bMarks[startLine] + state.tShift[startLine], max = state.eMarks[startLine];
    if (pos + 3 > max) {
      return false;
    }
    marker = state.src.charCodeAt(pos);
    if (marker !== 126 && marker !== 96) {
      return false;
    }
    mem = pos;
    pos = state.skipChars(pos, marker);
    len = pos - mem;
    if (len < 3) {
      return false;
    }
    params = state.src.slice(pos, max).trim();
    if (params.indexOf("`") >= 0) {
      return false;
    }
    if (silent) {
      return true;
    }
    nextLine = startLine;
    for (; ; ) {
      nextLine++;
      if (nextLine >= endLine) {
        break;
      }
      pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (pos < max && state.tShift[nextLine] < state.blkIndent) {
        break;
      }
      if (state.src.charCodeAt(pos) !== marker) {
        continue;
      }
      if (state.tShift[nextLine] - state.blkIndent >= 4) {
        continue;
      }
      pos = state.skipChars(pos, marker);
      if (pos - mem < len) {
        continue;
      }
      pos = state.skipSpaces(pos);
      if (pos < max) {
        continue;
      }
      haveEndMarker = true;
      break;
    }
    len = state.tShift[startLine];
    state.line = nextLine + (haveEndMarker ? 1 : 0);
    state.tokens.push({
      type: "fence",
      params,
      content: state.getLines(startLine + 1, nextLine, len, true),
      lines: [startLine, state.line],
      level: state.level
    });
    return true;
  }
  function blockquote(state, startLine, endLine, silent) {
    var nextLine, lastLineEmpty, oldTShift, oldBMarks, oldIndent, oldParentType, lines, terminatorRules, i2, l, terminate, pos = state.bMarks[startLine] + state.tShift[startLine], max = state.eMarks[startLine];
    if (pos > max) {
      return false;
    }
    if (state.src.charCodeAt(pos++) !== 62) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    if (silent) {
      return true;
    }
    if (state.src.charCodeAt(pos) === 32) {
      pos++;
    }
    oldIndent = state.blkIndent;
    state.blkIndent = 0;
    oldBMarks = [state.bMarks[startLine]];
    state.bMarks[startLine] = pos;
    pos = pos < max ? state.skipSpaces(pos) : pos;
    lastLineEmpty = pos >= max;
    oldTShift = [state.tShift[startLine]];
    state.tShift[startLine] = pos - state.bMarks[startLine];
    terminatorRules = state.parser.ruler.getRules("blockquote");
    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      if (pos >= max) {
        break;
      }
      if (state.src.charCodeAt(pos++) === 62) {
        if (state.src.charCodeAt(pos) === 32) {
          pos++;
        }
        oldBMarks.push(state.bMarks[nextLine]);
        state.bMarks[nextLine] = pos;
        pos = pos < max ? state.skipSpaces(pos) : pos;
        lastLineEmpty = pos >= max;
        oldTShift.push(state.tShift[nextLine]);
        state.tShift[nextLine] = pos - state.bMarks[nextLine];
        continue;
      }
      if (lastLineEmpty) {
        break;
      }
      terminate = false;
      for (i2 = 0, l = terminatorRules.length; i2 < l; i2++) {
        if (terminatorRules[i2](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
      oldBMarks.push(state.bMarks[nextLine]);
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = -1337;
    }
    oldParentType = state.parentType;
    state.parentType = "blockquote";
    state.tokens.push({
      type: "blockquote_open",
      lines: lines = [startLine, 0],
      level: state.level++
    });
    state.parser.tokenize(state, startLine, nextLine);
    state.tokens.push({
      type: "blockquote_close",
      level: --state.level
    });
    state.parentType = oldParentType;
    lines[1] = state.line;
    for (i2 = 0; i2 < oldTShift.length; i2++) {
      state.bMarks[i2 + startLine] = oldBMarks[i2];
      state.tShift[i2 + startLine] = oldTShift[i2];
    }
    state.blkIndent = oldIndent;
    return true;
  }
  function hr(state, startLine, endLine, silent) {
    var marker, cnt, ch, pos = state.bMarks[startLine], max = state.eMarks[startLine];
    pos += state.tShift[startLine];
    if (pos > max) {
      return false;
    }
    marker = state.src.charCodeAt(pos++);
    if (marker !== 42 && marker !== 45 && marker !== 95) {
      return false;
    }
    cnt = 1;
    while (pos < max) {
      ch = state.src.charCodeAt(pos++);
      if (ch !== marker && ch !== 32) {
        return false;
      }
      if (ch === marker) {
        cnt++;
      }
    }
    if (cnt < 3) {
      return false;
    }
    if (silent) {
      return true;
    }
    state.line = startLine + 1;
    state.tokens.push({
      type: "hr",
      lines: [startLine, state.line],
      level: state.level
    });
    return true;
  }
  function skipBulletListMarker(state, startLine) {
    var marker, pos, max;
    pos = state.bMarks[startLine] + state.tShift[startLine];
    max = state.eMarks[startLine];
    if (pos >= max) {
      return -1;
    }
    marker = state.src.charCodeAt(pos++);
    if (marker !== 42 && marker !== 45 && marker !== 43) {
      return -1;
    }
    if (pos < max && state.src.charCodeAt(pos) !== 32) {
      return -1;
    }
    return pos;
  }
  function skipOrderedListMarker(state, startLine) {
    var ch, pos = state.bMarks[startLine] + state.tShift[startLine], max = state.eMarks[startLine];
    if (pos + 1 >= max) {
      return -1;
    }
    ch = state.src.charCodeAt(pos++);
    if (ch < 48 || ch > 57) {
      return -1;
    }
    for (; ; ) {
      if (pos >= max) {
        return -1;
      }
      ch = state.src.charCodeAt(pos++);
      if (ch >= 48 && ch <= 57) {
        continue;
      }
      if (ch === 41 || ch === 46) {
        break;
      }
      return -1;
    }
    if (pos < max && state.src.charCodeAt(pos) !== 32) {
      return -1;
    }
    return pos;
  }
  function markTightParagraphs(state, idx) {
    var i2, l, level = state.level + 2;
    for (i2 = idx + 2, l = state.tokens.length - 2; i2 < l; i2++) {
      if (state.tokens[i2].level === level && state.tokens[i2].type === "paragraph_open") {
        state.tokens[i2 + 2].tight = true;
        state.tokens[i2].tight = true;
        i2 += 2;
      }
    }
  }
  function list(state, startLine, endLine, silent) {
    var nextLine, indent, oldTShift, oldIndent, oldTight, oldParentType, start, posAfterMarker, max, indentAfterMarker, markerValue, markerCharCode, isOrdered, contentStart, listTokIdx, prevEmptyEnd, listLines, itemLines, tight = true, terminatorRules, i2, l, terminate;
    if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
      isOrdered = true;
    } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
      isOrdered = false;
    } else {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
    if (silent) {
      return true;
    }
    listTokIdx = state.tokens.length;
    if (isOrdered) {
      start = state.bMarks[startLine] + state.tShift[startLine];
      markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));
      state.tokens.push({
        type: "ordered_list_open",
        order: markerValue,
        lines: listLines = [startLine, 0],
        level: state.level++
      });
    } else {
      state.tokens.push({
        type: "bullet_list_open",
        lines: listLines = [startLine, 0],
        level: state.level++
      });
    }
    nextLine = startLine;
    prevEmptyEnd = false;
    terminatorRules = state.parser.ruler.getRules("list");
    while (nextLine < endLine) {
      contentStart = state.skipSpaces(posAfterMarker);
      max = state.eMarks[nextLine];
      if (contentStart >= max) {
        indentAfterMarker = 1;
      } else {
        indentAfterMarker = contentStart - posAfterMarker;
      }
      if (indentAfterMarker > 4) {
        indentAfterMarker = 1;
      }
      if (indentAfterMarker < 1) {
        indentAfterMarker = 1;
      }
      indent = posAfterMarker - state.bMarks[nextLine] + indentAfterMarker;
      state.tokens.push({
        type: "list_item_open",
        lines: itemLines = [startLine, 0],
        level: state.level++
      });
      oldIndent = state.blkIndent;
      oldTight = state.tight;
      oldTShift = state.tShift[startLine];
      oldParentType = state.parentType;
      state.tShift[startLine] = contentStart - state.bMarks[startLine];
      state.blkIndent = indent;
      state.tight = true;
      state.parentType = "list";
      state.parser.tokenize(state, startLine, endLine, true);
      if (!state.tight || prevEmptyEnd) {
        tight = false;
      }
      prevEmptyEnd = state.line - startLine > 1 && state.isEmpty(state.line - 1);
      state.blkIndent = oldIndent;
      state.tShift[startLine] = oldTShift;
      state.tight = oldTight;
      state.parentType = oldParentType;
      state.tokens.push({
        type: "list_item_close",
        level: --state.level
      });
      nextLine = startLine = state.line;
      itemLines[1] = nextLine;
      contentStart = state.bMarks[startLine];
      if (nextLine >= endLine) {
        break;
      }
      if (state.isEmpty(nextLine)) {
        break;
      }
      if (state.tShift[nextLine] < state.blkIndent) {
        break;
      }
      terminate = false;
      for (i2 = 0, l = terminatorRules.length; i2 < l; i2++) {
        if (terminatorRules[i2](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) {
        break;
      }
      if (isOrdered) {
        posAfterMarker = skipOrderedListMarker(state, nextLine);
        if (posAfterMarker < 0) {
          break;
        }
      } else {
        posAfterMarker = skipBulletListMarker(state, nextLine);
        if (posAfterMarker < 0) {
          break;
        }
      }
      if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) {
        break;
      }
    }
    state.tokens.push({
      type: isOrdered ? "ordered_list_close" : "bullet_list_close",
      level: --state.level
    });
    listLines[1] = nextLine;
    state.line = nextLine;
    if (tight) {
      markTightParagraphs(state, listTokIdx);
    }
    return true;
  }
  function footnote(state, startLine, endLine, silent) {
    var oldBMark, oldTShift, oldParentType, pos, label, start = state.bMarks[startLine] + state.tShift[startLine], max = state.eMarks[startLine];
    if (start + 4 > max) {
      return false;
    }
    if (state.src.charCodeAt(start) !== 91) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 94) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    for (pos = start + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 32) {
        return false;
      }
      if (state.src.charCodeAt(pos) === 93) {
        break;
      }
    }
    if (pos === start + 2) {
      return false;
    }
    if (pos + 1 >= max || state.src.charCodeAt(++pos) !== 58) {
      return false;
    }
    if (silent) {
      return true;
    }
    pos++;
    if (!state.env.footnotes) {
      state.env.footnotes = {};
    }
    if (!state.env.footnotes.refs) {
      state.env.footnotes.refs = {};
    }
    label = state.src.slice(start + 2, pos - 2);
    state.env.footnotes.refs[":" + label] = -1;
    state.tokens.push({
      type: "footnote_reference_open",
      label,
      level: state.level++
    });
    oldBMark = state.bMarks[startLine];
    oldTShift = state.tShift[startLine];
    oldParentType = state.parentType;
    state.tShift[startLine] = state.skipSpaces(pos) - pos;
    state.bMarks[startLine] = pos;
    state.blkIndent += 4;
    state.parentType = "footnote";
    if (state.tShift[startLine] < state.blkIndent) {
      state.tShift[startLine] += state.blkIndent;
      state.bMarks[startLine] -= state.blkIndent;
    }
    state.parser.tokenize(state, startLine, endLine, true);
    state.parentType = oldParentType;
    state.blkIndent -= 4;
    state.tShift[startLine] = oldTShift;
    state.bMarks[startLine] = oldBMark;
    state.tokens.push({
      type: "footnote_reference_close",
      level: --state.level
    });
    return true;
  }
  function heading(state, startLine, endLine, silent) {
    var ch, level, tmp, pos = state.bMarks[startLine] + state.tShift[startLine], max = state.eMarks[startLine];
    if (pos >= max) {
      return false;
    }
    ch = state.src.charCodeAt(pos);
    if (ch !== 35 || pos >= max) {
      return false;
    }
    level = 1;
    ch = state.src.charCodeAt(++pos);
    while (ch === 35 && pos < max && level <= 6) {
      level++;
      ch = state.src.charCodeAt(++pos);
    }
    if (level > 6 || pos < max && ch !== 32) {
      return false;
    }
    if (silent) {
      return true;
    }
    max = state.skipCharsBack(max, 32, pos);
    tmp = state.skipCharsBack(max, 35, pos);
    if (tmp > pos && state.src.charCodeAt(tmp - 1) === 32) {
      max = tmp;
    }
    state.line = startLine + 1;
    state.tokens.push({
      type: "heading_open",
      hLevel: level,
      lines: [startLine, state.line],
      level: state.level
    });
    if (pos < max) {
      state.tokens.push({
        type: "inline",
        content: state.src.slice(pos, max).trim(),
        level: state.level + 1,
        lines: [startLine, state.line],
        children: []
      });
    }
    state.tokens.push({ type: "heading_close", hLevel: level, level: state.level });
    return true;
  }
  function lheading(state, startLine, endLine) {
    var marker, pos, max, next2 = startLine + 1;
    if (next2 >= endLine) {
      return false;
    }
    if (state.tShift[next2] < state.blkIndent) {
      return false;
    }
    if (state.tShift[next2] - state.blkIndent > 3) {
      return false;
    }
    pos = state.bMarks[next2] + state.tShift[next2];
    max = state.eMarks[next2];
    if (pos >= max) {
      return false;
    }
    marker = state.src.charCodeAt(pos);
    if (marker !== 45 && marker !== 61) {
      return false;
    }
    pos = state.skipChars(pos, marker);
    pos = state.skipSpaces(pos);
    if (pos < max) {
      return false;
    }
    pos = state.bMarks[startLine] + state.tShift[startLine];
    state.line = next2 + 1;
    state.tokens.push({
      type: "heading_open",
      hLevel: marker === 61 ? 1 : 2,
      lines: [startLine, state.line],
      level: state.level
    });
    state.tokens.push({
      type: "inline",
      content: state.src.slice(pos, state.eMarks[startLine]).trim(),
      level: state.level + 1,
      lines: [startLine, state.line - 1],
      children: []
    });
    state.tokens.push({
      type: "heading_close",
      hLevel: marker === 61 ? 1 : 2,
      level: state.level
    });
    return true;
  }
  var html_blocks = {};
  [
    "article",
    "aside",
    "button",
    "blockquote",
    "body",
    "canvas",
    "caption",
    "col",
    "colgroup",
    "dd",
    "div",
    "dl",
    "dt",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "iframe",
    "li",
    "map",
    "object",
    "ol",
    "output",
    "p",
    "pre",
    "progress",
    "script",
    "section",
    "style",
    "table",
    "tbody",
    "td",
    "textarea",
    "tfoot",
    "th",
    "tr",
    "thead",
    "ul",
    "video"
  ].forEach(function(name2) {
    html_blocks[name2] = true;
  });
  var HTML_TAG_OPEN_RE = /^<([a-zA-Z]{1,15})[\s\/>]/;
  var HTML_TAG_CLOSE_RE = /^<\/([a-zA-Z]{1,15})[\s>]/;
  function isLetter$1(ch) {
    var lc = ch | 32;
    return lc >= 97 && lc <= 122;
  }
  function htmlblock(state, startLine, endLine, silent) {
    var ch, match, nextLine, pos = state.bMarks[startLine], max = state.eMarks[startLine], shift = state.tShift[startLine];
    pos += shift;
    if (!state.options.html) {
      return false;
    }
    if (shift > 3 || pos + 2 >= max) {
      return false;
    }
    if (state.src.charCodeAt(pos) !== 60) {
      return false;
    }
    ch = state.src.charCodeAt(pos + 1);
    if (ch === 33 || ch === 63) {
      if (silent) {
        return true;
      }
    } else if (ch === 47 || isLetter$1(ch)) {
      if (ch === 47) {
        match = state.src.slice(pos, max).match(HTML_TAG_CLOSE_RE);
        if (!match) {
          return false;
        }
      } else {
        match = state.src.slice(pos, max).match(HTML_TAG_OPEN_RE);
        if (!match) {
          return false;
        }
      }
      if (html_blocks[match[1].toLowerCase()] !== true) {
        return false;
      }
      if (silent) {
        return true;
      }
    } else {
      return false;
    }
    nextLine = startLine + 1;
    while (nextLine < state.lineMax && !state.isEmpty(nextLine)) {
      nextLine++;
    }
    state.line = nextLine;
    state.tokens.push({
      type: "htmlblock",
      level: state.level,
      lines: [startLine, state.line],
      content: state.getLines(startLine, nextLine, 0, true)
    });
    return true;
  }
  function getLine$1(state, line) {
    var pos = state.bMarks[line] + state.blkIndent, max = state.eMarks[line];
    return state.src.substr(pos, max - pos);
  }
  function table(state, startLine, endLine, silent) {
    var ch, lineText, pos, i2, nextLine, rows, cell, aligns, t, tableLines, tbodyLines;
    if (startLine + 2 > endLine) {
      return false;
    }
    nextLine = startLine + 1;
    if (state.tShift[nextLine] < state.blkIndent) {
      return false;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    if (pos >= state.eMarks[nextLine]) {
      return false;
    }
    ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58) {
      return false;
    }
    lineText = getLine$1(state, startLine + 1);
    if (!/^[-:| ]+$/.test(lineText)) {
      return false;
    }
    rows = lineText.split("|");
    if (rows <= 2) {
      return false;
    }
    aligns = [];
    for (i2 = 0; i2 < rows.length; i2++) {
      t = rows[i2].trim();
      if (!t) {
        if (i2 === 0 || i2 === rows.length - 1) {
          continue;
        } else {
          return false;
        }
      }
      if (!/^:?-+:?$/.test(t)) {
        return false;
      }
      if (t.charCodeAt(t.length - 1) === 58) {
        aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
      } else if (t.charCodeAt(0) === 58) {
        aligns.push("left");
      } else {
        aligns.push("");
      }
    }
    lineText = getLine$1(state, startLine).trim();
    if (lineText.indexOf("|") === -1) {
      return false;
    }
    rows = lineText.replace(/^\||\|$/g, "").split("|");
    if (aligns.length !== rows.length) {
      return false;
    }
    if (silent) {
      return true;
    }
    state.tokens.push({
      type: "table_open",
      lines: tableLines = [startLine, 0],
      level: state.level++
    });
    state.tokens.push({
      type: "thead_open",
      lines: [startLine, startLine + 1],
      level: state.level++
    });
    state.tokens.push({
      type: "tr_open",
      lines: [startLine, startLine + 1],
      level: state.level++
    });
    for (i2 = 0; i2 < rows.length; i2++) {
      state.tokens.push({
        type: "th_open",
        align: aligns[i2],
        lines: [startLine, startLine + 1],
        level: state.level++
      });
      state.tokens.push({
        type: "inline",
        content: rows[i2].trim(),
        lines: [startLine, startLine + 1],
        level: state.level,
        children: []
      });
      state.tokens.push({ type: "th_close", level: --state.level });
    }
    state.tokens.push({ type: "tr_close", level: --state.level });
    state.tokens.push({ type: "thead_close", level: --state.level });
    state.tokens.push({
      type: "tbody_open",
      lines: tbodyLines = [startLine + 2, 0],
      level: state.level++
    });
    for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
      if (state.tShift[nextLine] < state.blkIndent) {
        break;
      }
      lineText = getLine$1(state, nextLine).trim();
      if (lineText.indexOf("|") === -1) {
        break;
      }
      rows = lineText.replace(/^\||\|$/g, "").split("|");
      state.tokens.push({ type: "tr_open", level: state.level++ });
      for (i2 = 0; i2 < rows.length; i2++) {
        state.tokens.push({ type: "td_open", align: aligns[i2], level: state.level++ });
        cell = rows[i2].substring(
          rows[i2].charCodeAt(0) === 124 ? 1 : 0,
          rows[i2].charCodeAt(rows[i2].length - 1) === 124 ? rows[i2].length - 1 : rows[i2].length
        ).trim();
        state.tokens.push({
          type: "inline",
          content: cell,
          level: state.level,
          children: []
        });
        state.tokens.push({ type: "td_close", level: --state.level });
      }
      state.tokens.push({ type: "tr_close", level: --state.level });
    }
    state.tokens.push({ type: "tbody_close", level: --state.level });
    state.tokens.push({ type: "table_close", level: --state.level });
    tableLines[1] = tbodyLines[1] = nextLine;
    state.line = nextLine;
    return true;
  }
  function skipMarker(state, line) {
    var pos, marker, start = state.bMarks[line] + state.tShift[line], max = state.eMarks[line];
    if (start >= max) {
      return -1;
    }
    marker = state.src.charCodeAt(start++);
    if (marker !== 126 && marker !== 58) {
      return -1;
    }
    pos = state.skipSpaces(start);
    if (start === pos) {
      return -1;
    }
    if (pos >= max) {
      return -1;
    }
    return pos;
  }
  function markTightParagraphs$1(state, idx) {
    var i2, l, level = state.level + 2;
    for (i2 = idx + 2, l = state.tokens.length - 2; i2 < l; i2++) {
      if (state.tokens[i2].level === level && state.tokens[i2].type === "paragraph_open") {
        state.tokens[i2 + 2].tight = true;
        state.tokens[i2].tight = true;
        i2 += 2;
      }
    }
  }
  function deflist(state, startLine, endLine, silent) {
    var contentStart, ddLine, dtLine, itemLines, listLines, listTokIdx, nextLine, oldIndent, oldDDIndent, oldParentType, oldTShift, oldTight, prevEmptyEnd, tight;
    if (silent) {
      if (state.ddIndent < 0) {
        return false;
      }
      return skipMarker(state, startLine) >= 0;
    }
    nextLine = startLine + 1;
    if (state.isEmpty(nextLine)) {
      if (++nextLine > endLine) {
        return false;
      }
    }
    if (state.tShift[nextLine] < state.blkIndent) {
      return false;
    }
    contentStart = skipMarker(state, nextLine);
    if (contentStart < 0) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    listTokIdx = state.tokens.length;
    state.tokens.push({
      type: "dl_open",
      lines: listLines = [startLine, 0],
      level: state.level++
    });
    dtLine = startLine;
    ddLine = nextLine;
    OUTER:
      for (; ; ) {
        tight = true;
        prevEmptyEnd = false;
        state.tokens.push({
          type: "dt_open",
          lines: [dtLine, dtLine],
          level: state.level++
        });
        state.tokens.push({
          type: "inline",
          content: state.getLines(dtLine, dtLine + 1, state.blkIndent, false).trim(),
          level: state.level + 1,
          lines: [dtLine, dtLine],
          children: []
        });
        state.tokens.push({
          type: "dt_close",
          level: --state.level
        });
        for (; ; ) {
          state.tokens.push({
            type: "dd_open",
            lines: itemLines = [nextLine, 0],
            level: state.level++
          });
          oldTight = state.tight;
          oldDDIndent = state.ddIndent;
          oldIndent = state.blkIndent;
          oldTShift = state.tShift[ddLine];
          oldParentType = state.parentType;
          state.blkIndent = state.ddIndent = state.tShift[ddLine] + 2;
          state.tShift[ddLine] = contentStart - state.bMarks[ddLine];
          state.tight = true;
          state.parentType = "deflist";
          state.parser.tokenize(state, ddLine, endLine, true);
          if (!state.tight || prevEmptyEnd) {
            tight = false;
          }
          prevEmptyEnd = state.line - ddLine > 1 && state.isEmpty(state.line - 1);
          state.tShift[ddLine] = oldTShift;
          state.tight = oldTight;
          state.parentType = oldParentType;
          state.blkIndent = oldIndent;
          state.ddIndent = oldDDIndent;
          state.tokens.push({
            type: "dd_close",
            level: --state.level
          });
          itemLines[1] = nextLine = state.line;
          if (nextLine >= endLine) {
            break OUTER;
          }
          if (state.tShift[nextLine] < state.blkIndent) {
            break OUTER;
          }
          contentStart = skipMarker(state, nextLine);
          if (contentStart < 0) {
            break;
          }
          ddLine = nextLine;
        }
        if (nextLine >= endLine) {
          break;
        }
        dtLine = nextLine;
        if (state.isEmpty(dtLine)) {
          break;
        }
        if (state.tShift[dtLine] < state.blkIndent) {
          break;
        }
        ddLine = dtLine + 1;
        if (ddLine >= endLine) {
          break;
        }
        if (state.isEmpty(ddLine)) {
          ddLine++;
        }
        if (ddLine >= endLine) {
          break;
        }
        if (state.tShift[ddLine] < state.blkIndent) {
          break;
        }
        contentStart = skipMarker(state, ddLine);
        if (contentStart < 0) {
          break;
        }
      }
    state.tokens.push({
      type: "dl_close",
      level: --state.level
    });
    listLines[1] = nextLine;
    state.line = nextLine;
    if (tight) {
      markTightParagraphs$1(state, listTokIdx);
    }
    return true;
  }
  function paragraph(state, startLine) {
    var endLine, content, terminate, i2, l, nextLine = startLine + 1, terminatorRules;
    endLine = state.lineMax;
    if (nextLine < endLine && !state.isEmpty(nextLine)) {
      terminatorRules = state.parser.ruler.getRules("paragraph");
      for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
        if (state.tShift[nextLine] - state.blkIndent > 3) {
          continue;
        }
        terminate = false;
        for (i2 = 0, l = terminatorRules.length; i2 < l; i2++) {
          if (terminatorRules[i2](state, nextLine, endLine, true)) {
            terminate = true;
            break;
          }
        }
        if (terminate) {
          break;
        }
      }
    }
    content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
    state.line = nextLine;
    if (content.length) {
      state.tokens.push({
        type: "paragraph_open",
        tight: false,
        lines: [startLine, state.line],
        level: state.level
      });
      state.tokens.push({
        type: "inline",
        content,
        level: state.level + 1,
        lines: [startLine, state.line],
        children: []
      });
      state.tokens.push({
        type: "paragraph_close",
        tight: false,
        level: state.level
      });
    }
    return true;
  }
  var _rules$1 = [
    ["code", code],
    ["fences", fences, ["paragraph", "blockquote", "list"]],
    ["blockquote", blockquote, ["paragraph", "blockquote", "list"]],
    ["hr", hr, ["paragraph", "blockquote", "list"]],
    ["list", list, ["paragraph", "blockquote"]],
    ["footnote", footnote, ["paragraph"]],
    ["heading", heading, ["paragraph", "blockquote"]],
    ["lheading", lheading],
    ["htmlblock", htmlblock, ["paragraph", "blockquote"]],
    ["table", table, ["paragraph"]],
    ["deflist", deflist, ["paragraph"]],
    ["paragraph", paragraph]
  ];
  function ParserBlock() {
    this.ruler = new Ruler();
    for (var i2 = 0; i2 < _rules$1.length; i2++) {
      this.ruler.push(_rules$1[i2][0], _rules$1[i2][1], {
        alt: (_rules$1[i2][2] || []).slice()
      });
    }
  }
  ParserBlock.prototype.tokenize = function(state, startLine, endLine) {
    var rules2 = this.ruler.getRules("");
    var len = rules2.length;
    var line = startLine;
    var hasEmptyLines = false;
    var ok, i2;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) {
        break;
      }
      if (state.tShift[line] < state.blkIndent) {
        break;
      }
      for (i2 = 0; i2 < len; i2++) {
        ok = rules2[i2](state, line, endLine, false);
        if (ok) {
          break;
        }
      }
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) {
        hasEmptyLines = true;
      }
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        if (line < endLine && state.parentType === "list" && state.isEmpty(line)) {
          break;
        }
        state.line = line;
      }
    }
  };
  var TABS_SCAN_RE = /[\n\t]/g;
  var NEWLINES_RE = /\r[\n\u0085]|[\u2424\u2028\u0085]/g;
  var SPACES_RE = /\u00a0/g;
  ParserBlock.prototype.parse = function(str2, options, env, outTokens) {
    var state, lineStart = 0, lastTabPos = 0;
    if (!str2) {
      return [];
    }
    str2 = str2.replace(SPACES_RE, " ");
    str2 = str2.replace(NEWLINES_RE, "\n");
    if (str2.indexOf("	") >= 0) {
      str2 = str2.replace(TABS_SCAN_RE, function(match, offset) {
        var result;
        if (str2.charCodeAt(offset) === 10) {
          lineStart = offset + 1;
          lastTabPos = 0;
          return match;
        }
        result = "    ".slice((offset - lineStart - lastTabPos) % 4);
        lastTabPos = offset - lineStart + 1;
        return result;
      });
    }
    state = new StateBlock(str2, this, options, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  };
  function isTerminatorChar(ch) {
    switch (ch) {
      case 10:
      case 92:
      case 96:
      case 42:
      case 95:
      case 94:
      case 91:
      case 93:
      case 33:
      case 38:
      case 60:
      case 62:
      case 123:
      case 125:
      case 36:
      case 37:
      case 64:
      case 126:
      case 43:
      case 61:
      case 58:
        return true;
      default:
        return false;
    }
  }
  function text(state, silent) {
    var pos = state.pos;
    while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
      pos++;
    }
    if (pos === state.pos) {
      return false;
    }
    if (!silent) {
      state.pending += state.src.slice(state.pos, pos);
    }
    state.pos = pos;
    return true;
  }
  function newline(state, silent) {
    var pmax, max, pos = state.pos;
    if (state.src.charCodeAt(pos) !== 10) {
      return false;
    }
    pmax = state.pending.length - 1;
    max = state.posMax;
    if (!silent) {
      if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) {
        if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
          for (var i2 = pmax - 2; i2 >= 0; i2--) {
            if (state.pending.charCodeAt(i2) !== 32) {
              state.pending = state.pending.substring(0, i2 + 1);
              break;
            }
          }
          state.push({
            type: "hardbreak",
            level: state.level
          });
        } else {
          state.pending = state.pending.slice(0, -1);
          state.push({
            type: "softbreak",
            level: state.level
          });
        }
      } else {
        state.push({
          type: "softbreak",
          level: state.level
        });
      }
    }
    pos++;
    while (pos < max && state.src.charCodeAt(pos) === 32) {
      pos++;
    }
    state.pos = pos;
    return true;
  }
  var ESCAPED = [];
  for (var i$1 = 0; i$1 < 256; i$1++) {
    ESCAPED.push(0);
  }
  "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
    ESCAPED[ch.charCodeAt(0)] = 1;
  });
  function escape(state, silent) {
    var ch, pos = state.pos, max = state.posMax;
    if (state.src.charCodeAt(pos) !== 92) {
      return false;
    }
    pos++;
    if (pos < max) {
      ch = state.src.charCodeAt(pos);
      if (ch < 256 && ESCAPED[ch] !== 0) {
        if (!silent) {
          state.pending += state.src[pos];
        }
        state.pos += 2;
        return true;
      }
      if (ch === 10) {
        if (!silent) {
          state.push({
            type: "hardbreak",
            level: state.level
          });
        }
        pos++;
        while (pos < max && state.src.charCodeAt(pos) === 32) {
          pos++;
        }
        state.pos = pos;
        return true;
      }
    }
    if (!silent) {
      state.pending += "\\";
    }
    state.pos++;
    return true;
  }
  function backticks(state, silent) {
    var start, max, marker, matchStart, matchEnd, pos = state.pos, ch = state.src.charCodeAt(pos);
    if (ch !== 96) {
      return false;
    }
    start = pos;
    pos++;
    max = state.posMax;
    while (pos < max && state.src.charCodeAt(pos) === 96) {
      pos++;
    }
    marker = state.src.slice(start, pos);
    matchStart = matchEnd = pos;
    while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1) {
      matchEnd = matchStart + 1;
      while (matchEnd < max && state.src.charCodeAt(matchEnd) === 96) {
        matchEnd++;
      }
      if (matchEnd - matchStart === marker.length) {
        if (!silent) {
          state.push({
            type: "code",
            content: state.src.slice(pos, matchStart).replace(/[ \n]+/g, " ").trim(),
            block: false,
            level: state.level
          });
        }
        state.pos = matchEnd;
        return true;
      }
    }
    if (!silent) {
      state.pending += marker;
    }
    state.pos += marker.length;
    return true;
  }
  function del(state, silent) {
    var found, pos, stack, max = state.posMax, start = state.pos, lastChar, nextChar;
    if (state.src.charCodeAt(start) !== 126) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 4 >= max) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 126) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
    nextChar = state.src.charCodeAt(start + 2);
    if (lastChar === 126) {
      return false;
    }
    if (nextChar === 126) {
      return false;
    }
    if (nextChar === 32 || nextChar === 10) {
      return false;
    }
    pos = start + 2;
    while (pos < max && state.src.charCodeAt(pos) === 126) {
      pos++;
    }
    if (pos > start + 3) {
      state.pos += pos - start;
      if (!silent) {
        state.pending += state.src.slice(start, pos);
      }
      return true;
    }
    state.pos = start + 2;
    stack = 1;
    while (state.pos + 1 < max) {
      if (state.src.charCodeAt(state.pos) === 126) {
        if (state.src.charCodeAt(state.pos + 1) === 126) {
          lastChar = state.src.charCodeAt(state.pos - 1);
          nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
          if (nextChar !== 126 && lastChar !== 126) {
            if (lastChar !== 32 && lastChar !== 10) {
              stack--;
            } else if (nextChar !== 32 && nextChar !== 10) {
              stack++;
            }
            if (stack <= 0) {
              found = true;
              break;
            }
          }
        }
      }
      state.parser.skipToken(state);
    }
    if (!found) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 2;
    if (!silent) {
      state.push({ type: "del_open", level: state.level++ });
      state.parser.tokenize(state);
      state.push({ type: "del_close", level: --state.level });
    }
    state.pos = state.posMax + 2;
    state.posMax = max;
    return true;
  }
  function ins(state, silent) {
    var found, pos, stack, max = state.posMax, start = state.pos, lastChar, nextChar;
    if (state.src.charCodeAt(start) !== 43) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 4 >= max) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 43) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
    nextChar = state.src.charCodeAt(start + 2);
    if (lastChar === 43) {
      return false;
    }
    if (nextChar === 43) {
      return false;
    }
    if (nextChar === 32 || nextChar === 10) {
      return false;
    }
    pos = start + 2;
    while (pos < max && state.src.charCodeAt(pos) === 43) {
      pos++;
    }
    if (pos !== start + 2) {
      state.pos += pos - start;
      if (!silent) {
        state.pending += state.src.slice(start, pos);
      }
      return true;
    }
    state.pos = start + 2;
    stack = 1;
    while (state.pos + 1 < max) {
      if (state.src.charCodeAt(state.pos) === 43) {
        if (state.src.charCodeAt(state.pos + 1) === 43) {
          lastChar = state.src.charCodeAt(state.pos - 1);
          nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
          if (nextChar !== 43 && lastChar !== 43) {
            if (lastChar !== 32 && lastChar !== 10) {
              stack--;
            } else if (nextChar !== 32 && nextChar !== 10) {
              stack++;
            }
            if (stack <= 0) {
              found = true;
              break;
            }
          }
        }
      }
      state.parser.skipToken(state);
    }
    if (!found) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 2;
    if (!silent) {
      state.push({ type: "ins_open", level: state.level++ });
      state.parser.tokenize(state);
      state.push({ type: "ins_close", level: --state.level });
    }
    state.pos = state.posMax + 2;
    state.posMax = max;
    return true;
  }
  function mark(state, silent) {
    var found, pos, stack, max = state.posMax, start = state.pos, lastChar, nextChar;
    if (state.src.charCodeAt(start) !== 61) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 4 >= max) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 61) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
    nextChar = state.src.charCodeAt(start + 2);
    if (lastChar === 61) {
      return false;
    }
    if (nextChar === 61) {
      return false;
    }
    if (nextChar === 32 || nextChar === 10) {
      return false;
    }
    pos = start + 2;
    while (pos < max && state.src.charCodeAt(pos) === 61) {
      pos++;
    }
    if (pos !== start + 2) {
      state.pos += pos - start;
      if (!silent) {
        state.pending += state.src.slice(start, pos);
      }
      return true;
    }
    state.pos = start + 2;
    stack = 1;
    while (state.pos + 1 < max) {
      if (state.src.charCodeAt(state.pos) === 61) {
        if (state.src.charCodeAt(state.pos + 1) === 61) {
          lastChar = state.src.charCodeAt(state.pos - 1);
          nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
          if (nextChar !== 61 && lastChar !== 61) {
            if (lastChar !== 32 && lastChar !== 10) {
              stack--;
            } else if (nextChar !== 32 && nextChar !== 10) {
              stack++;
            }
            if (stack <= 0) {
              found = true;
              break;
            }
          }
        }
      }
      state.parser.skipToken(state);
    }
    if (!found) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 2;
    if (!silent) {
      state.push({ type: "mark_open", level: state.level++ });
      state.parser.tokenize(state);
      state.push({ type: "mark_close", level: --state.level });
    }
    state.pos = state.posMax + 2;
    state.posMax = max;
    return true;
  }
  function isAlphaNum(code2) {
    return code2 >= 48 && code2 <= 57 || code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122;
  }
  function scanDelims(state, start) {
    var pos = start, lastChar, nextChar, count, can_open = true, can_close = true, max = state.posMax, marker = state.src.charCodeAt(start);
    lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
    while (pos < max && state.src.charCodeAt(pos) === marker) {
      pos++;
    }
    if (pos >= max) {
      can_open = false;
    }
    count = pos - start;
    if (count >= 4) {
      can_open = can_close = false;
    } else {
      nextChar = pos < max ? state.src.charCodeAt(pos) : -1;
      if (nextChar === 32 || nextChar === 10) {
        can_open = false;
      }
      if (lastChar === 32 || lastChar === 10) {
        can_close = false;
      }
      if (marker === 95) {
        if (isAlphaNum(lastChar)) {
          can_open = false;
        }
        if (isAlphaNum(nextChar)) {
          can_close = false;
        }
      }
    }
    return {
      can_open,
      can_close,
      delims: count
    };
  }
  function emphasis(state, silent) {
    var startCount, count, found, oldCount, newCount, stack, res, max = state.posMax, start = state.pos, marker = state.src.charCodeAt(start);
    if (marker !== 95 && marker !== 42) {
      return false;
    }
    if (silent) {
      return false;
    }
    res = scanDelims(state, start);
    startCount = res.delims;
    if (!res.can_open) {
      state.pos += startCount;
      if (!silent) {
        state.pending += state.src.slice(start, state.pos);
      }
      return true;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    state.pos = start + startCount;
    stack = [startCount];
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === marker) {
        res = scanDelims(state, state.pos);
        count = res.delims;
        if (res.can_close) {
          oldCount = stack.pop();
          newCount = count;
          while (oldCount !== newCount) {
            if (newCount < oldCount) {
              stack.push(oldCount - newCount);
              break;
            }
            newCount -= oldCount;
            if (stack.length === 0) {
              break;
            }
            state.pos += oldCount;
            oldCount = stack.pop();
          }
          if (stack.length === 0) {
            startCount = oldCount;
            found = true;
            break;
          }
          state.pos += count;
          continue;
        }
        if (res.can_open) {
          stack.push(count);
        }
        state.pos += count;
        continue;
      }
      state.parser.skipToken(state);
    }
    if (!found) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + startCount;
    if (!silent) {
      if (startCount === 2 || startCount === 3) {
        state.push({ type: "strong_open", level: state.level++ });
      }
      if (startCount === 1 || startCount === 3) {
        state.push({ type: "em_open", level: state.level++ });
      }
      state.parser.tokenize(state);
      if (startCount === 1 || startCount === 3) {
        state.push({ type: "em_close", level: --state.level });
      }
      if (startCount === 2 || startCount === 3) {
        state.push({ type: "strong_close", level: --state.level });
      }
    }
    state.pos = state.posMax + startCount;
    state.posMax = max;
    return true;
  }
  var UNESCAPE_RE = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
  function sub(state, silent) {
    var found, content, max = state.posMax, start = state.pos;
    if (state.src.charCodeAt(start) !== 126) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 2 >= max) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    state.pos = start + 1;
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 126) {
        found = true;
        break;
      }
      state.parser.skipToken(state);
    }
    if (!found || start + 1 === state.pos) {
      state.pos = start;
      return false;
    }
    content = state.src.slice(start + 1, state.pos);
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 1;
    if (!silent) {
      state.push({
        type: "sub",
        level: state.level,
        content: content.replace(UNESCAPE_RE, "$1")
      });
    }
    state.pos = state.posMax + 1;
    state.posMax = max;
    return true;
  }
  var UNESCAPE_RE$1 = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;
  function sup(state, silent) {
    var found, content, max = state.posMax, start = state.pos;
    if (state.src.charCodeAt(start) !== 94) {
      return false;
    }
    if (silent) {
      return false;
    }
    if (start + 2 >= max) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    state.pos = start + 1;
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 94) {
        found = true;
        break;
      }
      state.parser.skipToken(state);
    }
    if (!found || start + 1 === state.pos) {
      state.pos = start;
      return false;
    }
    content = state.src.slice(start + 1, state.pos);
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start;
      return false;
    }
    state.posMax = state.pos;
    state.pos = start + 1;
    if (!silent) {
      state.push({
        type: "sup",
        level: state.level,
        content: content.replace(UNESCAPE_RE$1, "$1")
      });
    }
    state.pos = state.posMax + 1;
    state.posMax = max;
    return true;
  }
  function links(state, silent) {
    var labelStart, labelEnd, label, href, title, pos, ref, code2, isImage = false, oldPos = state.pos, max = state.posMax, start = state.pos, marker = state.src.charCodeAt(start);
    if (marker === 33) {
      isImage = true;
      marker = state.src.charCodeAt(++start);
    }
    if (marker !== 91) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    labelStart = start + 1;
    labelEnd = parseLinkLabel(state, start);
    if (labelEnd < 0) {
      return false;
    }
    pos = labelEnd + 1;
    if (pos < max && state.src.charCodeAt(pos) === 40) {
      pos++;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (code2 !== 32 && code2 !== 10) {
          break;
        }
      }
      if (pos >= max) {
        return false;
      }
      start = pos;
      if (parseLinkDestination(state, pos)) {
        href = state.linkContent;
        pos = state.pos;
      } else {
        href = "";
      }
      start = pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (code2 !== 32 && code2 !== 10) {
          break;
        }
      }
      if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
        title = state.linkContent;
        pos = state.pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (code2 !== 32 && code2 !== 10) {
            break;
          }
        }
      } else {
        title = "";
      }
      if (pos >= max || state.src.charCodeAt(pos) !== 41) {
        state.pos = oldPos;
        return false;
      }
      pos++;
    } else {
      if (state.linkLevel > 0) {
        return false;
      }
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (code2 !== 32 && code2 !== 10) {
          break;
        }
      }
      if (pos < max && state.src.charCodeAt(pos) === 91) {
        start = pos + 1;
        pos = parseLinkLabel(state, pos);
        if (pos >= 0) {
          label = state.src.slice(start, pos++);
        } else {
          pos = start - 1;
        }
      }
      if (!label) {
        if (typeof label === "undefined") {
          pos = labelEnd + 1;
        }
        label = state.src.slice(labelStart, labelEnd);
      }
      ref = state.env.references[normalizeReference(label)];
      if (!ref) {
        state.pos = oldPos;
        return false;
      }
      href = ref.href;
      title = ref.title;
    }
    if (!silent) {
      state.pos = labelStart;
      state.posMax = labelEnd;
      if (isImage) {
        state.push({
          type: "image",
          src: href,
          title,
          alt: state.src.substr(labelStart, labelEnd - labelStart),
          level: state.level
        });
      } else {
        state.push({
          type: "link_open",
          href,
          title,
          level: state.level++
        });
        state.linkLevel++;
        state.parser.tokenize(state);
        state.linkLevel--;
        state.push({ type: "link_close", level: --state.level });
      }
    }
    state.pos = pos;
    state.posMax = max;
    return true;
  }
  function footnote_inline(state, silent) {
    var labelStart, labelEnd, footnoteId, oldLength, max = state.posMax, start = state.pos;
    if (start + 2 >= max) {
      return false;
    }
    if (state.src.charCodeAt(start) !== 94) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 91) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    labelStart = start + 2;
    labelEnd = parseLinkLabel(state, start + 1);
    if (labelEnd < 0) {
      return false;
    }
    if (!silent) {
      if (!state.env.footnotes) {
        state.env.footnotes = {};
      }
      if (!state.env.footnotes.list) {
        state.env.footnotes.list = [];
      }
      footnoteId = state.env.footnotes.list.length;
      state.pos = labelStart;
      state.posMax = labelEnd;
      state.push({
        type: "footnote_ref",
        id: footnoteId,
        level: state.level
      });
      state.linkLevel++;
      oldLength = state.tokens.length;
      state.parser.tokenize(state);
      state.env.footnotes.list[footnoteId] = { tokens: state.tokens.splice(oldLength) };
      state.linkLevel--;
    }
    state.pos = labelEnd + 1;
    state.posMax = max;
    return true;
  }
  function footnote_ref(state, silent) {
    var label, pos, footnoteId, footnoteSubId, max = state.posMax, start = state.pos;
    if (start + 3 > max) {
      return false;
    }
    if (!state.env.footnotes || !state.env.footnotes.refs) {
      return false;
    }
    if (state.src.charCodeAt(start) !== 91) {
      return false;
    }
    if (state.src.charCodeAt(start + 1) !== 94) {
      return false;
    }
    if (state.level >= state.options.maxNesting) {
      return false;
    }
    for (pos = start + 2; pos < max; pos++) {
      if (state.src.charCodeAt(pos) === 32) {
        return false;
      }
      if (state.src.charCodeAt(pos) === 10) {
        return false;
      }
      if (state.src.charCodeAt(pos) === 93) {
        break;
      }
    }
    if (pos === start + 2) {
      return false;
    }
    if (pos >= max) {
      return false;
    }
    pos++;
    label = state.src.slice(start + 2, pos - 1);
    if (typeof state.env.footnotes.refs[":" + label] === "undefined") {
      return false;
    }
    if (!silent) {
      if (!state.env.footnotes.list) {
        state.env.footnotes.list = [];
      }
      if (state.env.footnotes.refs[":" + label] < 0) {
        footnoteId = state.env.footnotes.list.length;
        state.env.footnotes.list[footnoteId] = { label, count: 0 };
        state.env.footnotes.refs[":" + label] = footnoteId;
      } else {
        footnoteId = state.env.footnotes.refs[":" + label];
      }
      footnoteSubId = state.env.footnotes.list[footnoteId].count;
      state.env.footnotes.list[footnoteId].count++;
      state.push({
        type: "footnote_ref",
        id: footnoteId,
        subId: footnoteSubId,
        level: state.level
      });
    }
    state.pos = pos;
    state.posMax = max;
    return true;
  }
  var url_schemas = [
    "coap",
    "doi",
    "javascript",
    "aaa",
    "aaas",
    "about",
    "acap",
    "cap",
    "cid",
    "crid",
    "data",
    "dav",
    "dict",
    "dns",
    "file",
    "ftp",
    "geo",
    "go",
    "gopher",
    "h323",
    "http",
    "https",
    "iax",
    "icap",
    "im",
    "imap",
    "info",
    "ipp",
    "iris",
    "iris.beep",
    "iris.xpc",
    "iris.xpcs",
    "iris.lwz",
    "ldap",
    "mailto",
    "mid",
    "msrp",
    "msrps",
    "mtqp",
    "mupdate",
    "news",
    "nfs",
    "ni",
    "nih",
    "nntp",
    "opaquelocktoken",
    "pop",
    "pres",
    "rtsp",
    "service",
    "session",
    "shttp",
    "sieve",
    "sip",
    "sips",
    "sms",
    "snmp",
    "soap.beep",
    "soap.beeps",
    "tag",
    "tel",
    "telnet",
    "tftp",
    "thismessage",
    "tn3270",
    "tip",
    "tv",
    "urn",
    "vemmi",
    "ws",
    "wss",
    "xcon",
    "xcon-userid",
    "xmlrpc.beep",
    "xmlrpc.beeps",
    "xmpp",
    "z39.50r",
    "z39.50s",
    "adiumxtra",
    "afp",
    "afs",
    "aim",
    "apt",
    "attachment",
    "aw",
    "beshare",
    "bitcoin",
    "bolo",
    "callto",
    "chrome",
    "chrome-extension",
    "com-eventbrite-attendee",
    "content",
    "cvs",
    "dlna-playsingle",
    "dlna-playcontainer",
    "dtn",
    "dvb",
    "ed2k",
    "facetime",
    "feed",
    "finger",
    "fish",
    "gg",
    "git",
    "gizmoproject",
    "gtalk",
    "hcp",
    "icon",
    "ipn",
    "irc",
    "irc6",
    "ircs",
    "itms",
    "jar",
    "jms",
    "keyparc",
    "lastfm",
    "ldaps",
    "magnet",
    "maps",
    "market",
    "message",
    "mms",
    "ms-help",
    "msnim",
    "mumble",
    "mvn",
    "notes",
    "oid",
    "palm",
    "paparazzi",
    "platform",
    "proxy",
    "psyc",
    "query",
    "res",
    "resource",
    "rmi",
    "rsync",
    "rtmp",
    "secondlife",
    "sftp",
    "sgn",
    "skype",
    "smb",
    "soldat",
    "spotify",
    "ssh",
    "steam",
    "svn",
    "teamspeak",
    "things",
    "udp",
    "unreal",
    "ut2004",
    "ventrilo",
    "view-source",
    "webcal",
    "wtai",
    "wyciwyg",
    "xfire",
    "xri",
    "ymsgr"
  ];
  var EMAIL_RE = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
  var AUTOLINK_RE = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;
  function autolink(state, silent) {
    var tail, linkMatch, emailMatch, url, fullUrl, pos = state.pos;
    if (state.src.charCodeAt(pos) !== 60) {
      return false;
    }
    tail = state.src.slice(pos);
    if (tail.indexOf(">") < 0) {
      return false;
    }
    linkMatch = tail.match(AUTOLINK_RE);
    if (linkMatch) {
      if (url_schemas.indexOf(linkMatch[1].toLowerCase()) < 0) {
        return false;
      }
      url = linkMatch[0].slice(1, -1);
      fullUrl = normalizeLink(url);
      if (!state.parser.validateLink(url)) {
        return false;
      }
      if (!silent) {
        state.push({
          type: "link_open",
          href: fullUrl,
          level: state.level
        });
        state.push({
          type: "text",
          content: url,
          level: state.level + 1
        });
        state.push({ type: "link_close", level: state.level });
      }
      state.pos += linkMatch[0].length;
      return true;
    }
    emailMatch = tail.match(EMAIL_RE);
    if (emailMatch) {
      url = emailMatch[0].slice(1, -1);
      fullUrl = normalizeLink("mailto:" + url);
      if (!state.parser.validateLink(fullUrl)) {
        return false;
      }
      if (!silent) {
        state.push({
          type: "link_open",
          href: fullUrl,
          level: state.level
        });
        state.push({
          type: "text",
          content: url,
          level: state.level + 1
        });
        state.push({ type: "link_close", level: state.level });
      }
      state.pos += emailMatch[0].length;
      return true;
    }
    return false;
  }
  function replace$1(regex, options) {
    regex = regex.source;
    options = options || "";
    return function self(name2, val2) {
      if (!name2) {
        return new RegExp(regex, options);
      }
      val2 = val2.source || val2;
      regex = regex.replace(name2, val2);
      return self;
    };
  }
  var attr_name = /[a-zA-Z_:][a-zA-Z0-9:._-]*/;
  var unquoted = /[^"'=<>`\x00-\x20]+/;
  var single_quoted = /'[^']*'/;
  var double_quoted = /"[^"]*"/;
  var attr_value = replace$1(/(?:unquoted|single_quoted|double_quoted)/)("unquoted", unquoted)("single_quoted", single_quoted)("double_quoted", double_quoted)();
  var attribute = replace$1(/(?:\s+attr_name(?:\s*=\s*attr_value)?)/)("attr_name", attr_name)("attr_value", attr_value)();
  var open_tag = replace$1(/<[A-Za-z][A-Za-z0-9]*attribute*\s*\/?>/)("attribute", attribute)();
  var close_tag = /<\/[A-Za-z][A-Za-z0-9]*\s*>/;
  var comment = /<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->/;
  var processing = /<[?].*?[?]>/;
  var declaration = /<![A-Z]+\s+[^>]*>/;
  var cdata = /<!\[CDATA\[[\s\S]*?\]\]>/;
  var HTML_TAG_RE = replace$1(/^(?:open_tag|close_tag|comment|processing|declaration|cdata)/)("open_tag", open_tag)("close_tag", close_tag)("comment", comment)("processing", processing)("declaration", declaration)("cdata", cdata)();
  function isLetter$2(ch) {
    var lc = ch | 32;
    return lc >= 97 && lc <= 122;
  }
  function htmltag(state, silent) {
    var ch, match, max, pos = state.pos;
    if (!state.options.html) {
      return false;
    }
    max = state.posMax;
    if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) {
      return false;
    }
    ch = state.src.charCodeAt(pos + 1);
    if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter$2(ch)) {
      return false;
    }
    match = state.src.slice(pos).match(HTML_TAG_RE);
    if (!match) {
      return false;
    }
    if (!silent) {
      state.push({
        type: "htmltag",
        content: state.src.slice(pos, pos + match[0].length),
        level: state.level
      });
    }
    state.pos += match[0].length;
    return true;
  }
  var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i;
  var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
  function entity(state, silent) {
    var ch, code2, match, pos = state.pos, max = state.posMax;
    if (state.src.charCodeAt(pos) !== 38) {
      return false;
    }
    if (pos + 1 < max) {
      ch = state.src.charCodeAt(pos + 1);
      if (ch === 35) {
        match = state.src.slice(pos).match(DIGITAL_RE);
        if (match) {
          if (!silent) {
            code2 = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
            state.pending += isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
          }
          state.pos += match[0].length;
          return true;
        }
      } else {
        match = state.src.slice(pos).match(NAMED_RE);
        if (match) {
          var decoded = decodeEntity(match[1]);
          if (match[1] !== decoded) {
            if (!silent) {
              state.pending += decoded;
            }
            state.pos += match[0].length;
            return true;
          }
        }
      }
    }
    if (!silent) {
      state.pending += "&";
    }
    state.pos++;
    return true;
  }
  var _rules$2 = [
    ["text", text],
    ["newline", newline],
    ["escape", escape],
    ["backticks", backticks],
    ["del", del],
    ["ins", ins],
    ["mark", mark],
    ["emphasis", emphasis],
    ["sub", sub],
    ["sup", sup],
    ["links", links],
    ["footnote_inline", footnote_inline],
    ["footnote_ref", footnote_ref],
    ["autolink", autolink],
    ["htmltag", htmltag],
    ["entity", entity]
  ];
  function ParserInline() {
    this.ruler = new Ruler();
    for (var i2 = 0; i2 < _rules$2.length; i2++) {
      this.ruler.push(_rules$2[i2][0], _rules$2[i2][1]);
    }
    this.validateLink = validateLink;
  }
  ParserInline.prototype.skipToken = function(state) {
    var rules2 = this.ruler.getRules("");
    var len = rules2.length;
    var pos = state.pos;
    var i2, cached_pos;
    if ((cached_pos = state.cacheGet(pos)) > 0) {
      state.pos = cached_pos;
      return;
    }
    for (i2 = 0; i2 < len; i2++) {
      if (rules2[i2](state, true)) {
        state.cacheSet(pos, state.pos);
        return;
      }
    }
    state.pos++;
    state.cacheSet(pos, state.pos);
  };
  ParserInline.prototype.tokenize = function(state) {
    var rules2 = this.ruler.getRules("");
    var len = rules2.length;
    var end2 = state.posMax;
    var ok, i2;
    while (state.pos < end2) {
      for (i2 = 0; i2 < len; i2++) {
        ok = rules2[i2](state, false);
        if (ok) {
          break;
        }
      }
      if (ok) {
        if (state.pos >= end2) {
          break;
        }
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) {
      state.pushPending();
    }
  };
  ParserInline.prototype.parse = function(str2, options, env, outTokens) {
    var state = new StateInline(str2, this, options, env, outTokens);
    this.tokenize(state);
  };
  function validateLink(url) {
    var BAD_PROTOCOLS = ["vbscript", "javascript", "file", "data"];
    var str2 = url.trim().toLowerCase();
    str2 = replaceEntities(str2);
    if (str2.indexOf(":") !== -1 && BAD_PROTOCOLS.indexOf(str2.split(":")[0]) !== -1) {
      return false;
    }
    return true;
  }
  var defaultConfig = {
    options: {
      html: false,
      // Enable HTML tags in source
      xhtmlOut: false,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: "language-",
      // CSS language prefix for fenced blocks
      linkTarget: "",
      // set target to open link in
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
      quotes: "“”‘’",
      // Highlighter function. Should return escaped HTML,
      // or '' if input not changed
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 20
      // Internal protection, recursion limit
    },
    components: {
      core: {
        rules: [
          "block",
          "inline",
          "references",
          "replacements",
          "smartquotes",
          "references",
          "abbr2",
          "footnote_tail"
        ]
      },
      block: {
        rules: [
          "blockquote",
          "code",
          "fences",
          "footnote",
          "heading",
          "hr",
          "htmlblock",
          "lheading",
          "list",
          "paragraph",
          "table"
        ]
      },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "del",
          "emphasis",
          "entity",
          "escape",
          "footnote_ref",
          "htmltag",
          "links",
          "newline",
          "text"
        ]
      }
    }
  };
  var fullConfig = {
    options: {
      html: false,
      // Enable HTML tags in source
      xhtmlOut: false,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: "language-",
      // CSS language prefix for fenced blocks
      linkTarget: "",
      // set target to open link in
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
      quotes: "“”‘’",
      // Highlighter function. Should return escaped HTML,
      // or '' if input not changed
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 20
      // Internal protection, recursion limit
    },
    components: {
      // Don't restrict core/block/inline rules
      core: {},
      block: {},
      inline: {}
    }
  };
  var commonmarkConfig = {
    options: {
      html: true,
      // Enable HTML tags in source
      xhtmlOut: true,
      // Use '/' to close single tags (<br />)
      breaks: false,
      // Convert '\n' in paragraphs into <br>
      langPrefix: "language-",
      // CSS language prefix for fenced blocks
      linkTarget: "",
      // set target to open link in
      // Enable some language-neutral replacements + quotes beautification
      typographer: false,
      // Double + single quotes replacement pairs, when typographer enabled,
      // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
      quotes: "“”‘’",
      // Highlighter function. Should return escaped HTML,
      // or '' if input not changed
      //
      // function (/*str, lang*/) { return ''; }
      //
      highlight: null,
      maxNesting: 20
      // Internal protection, recursion limit
    },
    components: {
      core: {
        rules: [
          "block",
          "inline",
          "references",
          "abbr2"
        ]
      },
      block: {
        rules: [
          "blockquote",
          "code",
          "fences",
          "heading",
          "hr",
          "htmlblock",
          "lheading",
          "list",
          "paragraph"
        ]
      },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "emphasis",
          "entity",
          "escape",
          "htmltag",
          "links",
          "newline",
          "text"
        ]
      }
    }
  };
  var config$2 = {
    "default": defaultConfig,
    "full": fullConfig,
    "commonmark": commonmarkConfig
  };
  function StateCore(instance, str2, env) {
    this.src = str2;
    this.env = env;
    this.options = instance.options;
    this.tokens = [];
    this.inlineMode = false;
    this.inline = instance.inline;
    this.block = instance.block;
    this.renderer = instance.renderer;
    this.typographer = instance.typographer;
  }
  function Remarkable(preset, options) {
    if (typeof preset !== "string") {
      options = preset;
      preset = "default";
    }
    if (options && options.linkify != null) {
      console.warn(
        "linkify option is removed. Use linkify plugin instead:\n\nimport Remarkable from 'remarkable';\nimport linkify from 'remarkable/linkify';\nnew Remarkable().use(linkify)\n"
      );
    }
    this.inline = new ParserInline();
    this.block = new ParserBlock();
    this.core = new Core();
    this.renderer = new Renderer();
    this.ruler = new Ruler();
    this.options = {};
    this.configure(config$2[preset]);
    this.set(options || {});
  }
  Remarkable.prototype.set = function(options) {
    assign(this.options, options);
  };
  Remarkable.prototype.configure = function(presets) {
    var self = this;
    if (!presets) {
      throw new Error("Wrong `remarkable` preset, check name/content");
    }
    if (presets.options) {
      self.set(presets.options);
    }
    if (presets.components) {
      Object.keys(presets.components).forEach(function(name2) {
        if (presets.components[name2].rules) {
          self[name2].ruler.enable(presets.components[name2].rules, true);
        }
      });
    }
  };
  Remarkable.prototype.use = function(plugin2, options) {
    plugin2(this, options);
    return this;
  };
  Remarkable.prototype.parse = function(str2, env) {
    var state = new StateCore(this, str2, env);
    this.core.process(state);
    return state.tokens;
  };
  Remarkable.prototype.render = function(str2, env) {
    env = env || {};
    return this.renderer.render(this.parse(str2, env), this.options, env);
  };
  Remarkable.prototype.parseInline = function(str2, env) {
    var state = new StateCore(this, str2, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  };
  Remarkable.prototype.renderInline = function(str2, env) {
    env = env || {};
    return this.renderer.render(this.parseInline(str2, env), this.options, env);
  };
  function createTransformHooks(transformer) {
    return {
      transformer,
      parser: new Hook(),
      beforeParse: new Hook(),
      afterParse: new Hook(),
      htmltag: new Hook(),
      retransform: new Hook()
    };
  }
  function definePlugin(plugin2) {
    return plugin2;
  }
  const svgMarked = '<svg width="16" height="16" viewBox="0 -3 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>\n';
  const svgUnmarked = '<svg width="16" height="16" viewBox="0 -3 24 24"><path fill-rule="evenodd" d="M6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5z" clip-rule="evenodd"/></svg>\n';
  const name$5 = "checkbox";
  const images = {
    " ": svgUnmarked.trim(),
    x: svgMarked.trim()
  };
  const plugin$3 = definePlugin({
    name: name$5,
    transform(transformHooks) {
      transformHooks.parser.tap((md) => {
        md.core.ruler.before(
          "inline",
          "checkbox",
          (state) => {
            for (let i2 = 2; i2 < state.tokens.length; i2 += 1) {
              const token = state.tokens[i2];
              if (token.type === "inline" && token.content) {
                const prevType = state.tokens[i2 - 1].type;
                const prevPrevType = state.tokens[i2 - 2].type;
                if (prevType === "heading_open" || prevType === "paragraph_open" && prevPrevType === "list_item_open") {
                  token.content = token.content.replace(
                    /^\[(.)\] /,
                    (m, g) => images[g] ? `${images[g]} ` : m
                  );
                }
              }
            }
            return false;
          },
          {}
        );
      });
      return {};
    }
  });
  const pluginCheckbox = plugin$3;
  /*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT */
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence))
      return sequence;
    else if (isNothing(sequence))
      return [];
    return [sequence];
  }
  function extend(target, source) {
    var index2, length, key, sourceKeys;
    if (source) {
      sourceKeys = Object.keys(source);
      for (index2 = 0, length = sourceKeys.length; index2 < length; index2 += 1) {
        key = sourceKeys[index2];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    var result = "", cycle;
    for (cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  var isNothing_1 = isNothing;
  var isObject_1 = isObject;
  var toArray_1 = toArray;
  var repeat_1 = repeat;
  var isNegativeZero_1 = isNegativeZero;
  var extend_1 = extend;
  var common = {
    isNothing: isNothing_1,
    isObject: isObject_1,
    toArray: toArray_1,
    repeat: repeat_1,
    isNegativeZero: isNegativeZero_1,
    extend: extend_1
  };
  function formatError(exception2, compact) {
    var where = "", message = exception2.reason || "(unknown reason)";
    if (!exception2.mark)
      return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += "\n\n" + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException$1(reason, mark2) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark2;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException$1.prototype = Object.create(Error.prototype);
  YAMLException$1.prototype.constructor = YAMLException$1;
  YAMLException$1.prototype.toString = function toString2(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  var exception = YAMLException$1;
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    var head = "";
    var tail = "";
    var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
      // relative position
    };
  }
  function padStart(string, max) {
    return common.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark2, options) {
    options = Object.create(options || null);
    if (!mark2.buffer)
      return null;
    if (!options.maxLength)
      options.maxLength = 79;
    if (typeof options.indent !== "number")
      options.indent = 1;
    if (typeof options.linesBefore !== "number")
      options.linesBefore = 3;
    if (typeof options.linesAfter !== "number")
      options.linesAfter = 2;
    var re = /\r?\n|\r|\0/g;
    var lineStarts = [0];
    var lineEnds = [];
    var match;
    var foundLineNo = -1;
    while (match = re.exec(mark2.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark2.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0)
      foundLineNo = lineStarts.length - 1;
    var result = "", i2, line;
    var lineNoLength = Math.min(mark2.line + options.linesAfter, lineEnds.length).toString().length;
    var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (i2 = 1; i2 <= options.linesBefore; i2++) {
      if (foundLineNo - i2 < 0)
        break;
      line = getLine(
        mark2.buffer,
        lineStarts[foundLineNo - i2],
        lineEnds[foundLineNo - i2],
        mark2.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i2]),
        maxLineLength
      );
      result = common.repeat(" ", options.indent) + padStart((mark2.line - i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
    }
    line = getLine(mark2.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark2.position, maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark2.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (i2 = 1; i2 <= options.linesAfter; i2++) {
      if (foundLineNo + i2 >= lineEnds.length)
        break;
      line = getLine(
        mark2.buffer,
        lineStarts[foundLineNo + i2],
        lineEnds[foundLineNo + i2],
        mark2.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i2]),
        maxLineLength
      );
      result += common.repeat(" ", options.indent) + padStart((mark2.line + i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  var snippet = makeSnippet;
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    var result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type$1(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name2) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name2) === -1) {
        throw new exception('Unknown option "' + name2 + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data2) {
      return data2;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  var type = Type$1;
  function compileList(schema2, name2) {
    var result = [];
    schema2[name2].forEach(function(currentType) {
      var newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    var result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    }, index2, length;
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (index2 = 0, length = arguments.length; index2 < length; index2 += 1) {
      arguments[index2].forEach(collectType);
    }
    return result;
  }
  function Schema$1(definition) {
    return this.extend(definition);
  }
  Schema$1.prototype.extend = function extend2(definition) {
    var implicit = [];
    var explicit = [];
    if (definition instanceof type) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type$1.loadKind && type$1.loadKind !== "scalar") {
        throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type$1.multi) {
        throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    var result = Object.create(Schema$1.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  var schema = Schema$1;
  var str = new type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data2) {
      return data2 !== null ? data2 : "";
    }
  });
  var seq = new type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data2) {
      return data2 !== null ? data2 : [];
    }
  });
  var map = new type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data2) {
      return data2 !== null ? data2 : {};
    }
  });
  var failsafe = new schema({
    explicit: [
      str,
      seq,
      map
    ]
  });
  function resolveYamlNull(data2) {
    if (data2 === null)
      return true;
    var max = data2.length;
    return max === 1 && data2 === "~" || max === 4 && (data2 === "null" || data2 === "Null" || data2 === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  var _null = new type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  function resolveYamlBoolean(data2) {
    if (data2 === null)
      return false;
    var max = data2.length;
    return max === 4 && (data2 === "true" || data2 === "True" || data2 === "TRUE") || max === 5 && (data2 === "false" || data2 === "False" || data2 === "FALSE");
  }
  function constructYamlBoolean(data2) {
    return data2 === "true" || data2 === "True" || data2 === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  var bool = new type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  function isHexCode(c) {
    return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
  }
  function isOctCode(c) {
    return 48 <= c && c <= 55;
  }
  function isDecCode(c) {
    return 48 <= c && c <= 57;
  }
  function resolveYamlInteger(data2) {
    if (data2 === null)
      return false;
    var max = data2.length, index2 = 0, hasDigits = false, ch;
    if (!max)
      return false;
    ch = data2[index2];
    if (ch === "-" || ch === "+") {
      ch = data2[++index2];
    }
    if (ch === "0") {
      if (index2 + 1 === max)
        return true;
      ch = data2[++index2];
      if (ch === "b") {
        index2++;
        for (; index2 < max; index2++) {
          ch = data2[index2];
          if (ch === "_")
            continue;
          if (ch !== "0" && ch !== "1")
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "x") {
        index2++;
        for (; index2 < max; index2++) {
          ch = data2[index2];
          if (ch === "_")
            continue;
          if (!isHexCode(data2.charCodeAt(index2)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "o") {
        index2++;
        for (; index2 < max; index2++) {
          ch = data2[index2];
          if (ch === "_")
            continue;
          if (!isOctCode(data2.charCodeAt(index2)))
            return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
    }
    if (ch === "_")
      return false;
    for (; index2 < max; index2++) {
      ch = data2[index2];
      if (ch === "_")
        continue;
      if (!isDecCode(data2.charCodeAt(index2))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits || ch === "_")
      return false;
    return true;
  }
  function constructYamlInteger(data2) {
    var value = data2, sign = 1, ch;
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-")
        sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0")
      return 0;
    if (ch === "0") {
      if (value[1] === "b")
        return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x")
        return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o")
        return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
  }
  var int = new type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      /* eslint-disable max-len */
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  var YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data2) {
    if (data2 === null)
      return false;
    if (!YAML_FLOAT_PATTERN.test(data2) || // Quick hack to not allow integers end with `_`
    // Probably should update regexp & check speed
    data2[data2.length - 1] === "_") {
      return false;
    }
    return true;
  }
  function constructYamlFloat(data2) {
    var value, sign;
    value = data2.replace(/_/g, "").toLowerCase();
    sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common.isNegativeZero(object)) {
      return "-0.0";
    }
    res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
  }
  var float = new type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  var json = failsafe.extend({
    implicit: [
      _null,
      bool,
      int,
      float
    ]
  });
  var core = json;
  var YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  var YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data2) {
    if (data2 === null)
      return false;
    if (YAML_DATE_REGEXP.exec(data2) !== null)
      return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data2) !== null)
      return true;
    return false;
  }
  function constructYamlTimestamp(data2) {
    var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
    match = YAML_DATE_REGEXP.exec(data2);
    if (match === null)
      match = YAML_TIMESTAMP_REGEXP.exec(data2);
    if (match === null)
      throw new Error("Date resolve error");
    year = +match[1];
    month = +match[2] - 1;
    day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    hour = +match[4];
    minute = +match[5];
    second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      tz_hour = +match[10];
      tz_minute = +(match[11] || 0);
      delta = (tz_hour * 60 + tz_minute) * 6e4;
      if (match[9] === "-")
        delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
      date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  var timestamp = new type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  function resolveYamlMerge(data2) {
    return data2 === "<<" || data2 === null;
  }
  var merge = new type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data2) {
    if (data2 === null)
      return false;
    var code2, idx, bitlen = 0, max = data2.length, map2 = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      code2 = map2.indexOf(data2.charAt(idx));
      if (code2 > 64)
        continue;
      if (code2 < 0)
        return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data2) {
    var idx, tailbits, input = data2.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
    for (idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  var binary = new type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
  var _toString$2 = Object.prototype.toString;
  function resolveYamlOmap(data2) {
    if (data2 === null)
      return true;
    var objectKeys = [], index2, length, pair, pairKey, pairHasKey, object = data2;
    for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
      pair = object[index2];
      pairHasKey = false;
      if (_toString$2.call(pair) !== "[object Object]")
        return false;
      for (pairKey in pair) {
        if (_hasOwnProperty$3.call(pair, pairKey)) {
          if (!pairHasKey)
            pairHasKey = true;
          else
            return false;
        }
      }
      if (!pairHasKey)
        return false;
      if (objectKeys.indexOf(pairKey) === -1)
        objectKeys.push(pairKey);
      else
        return false;
    }
    return true;
  }
  function constructYamlOmap(data2) {
    return data2 !== null ? data2 : [];
  }
  var omap = new type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  var _toString$1 = Object.prototype.toString;
  function resolveYamlPairs(data2) {
    if (data2 === null)
      return true;
    var index2, length, pair, keys, result, object = data2;
    result = new Array(object.length);
    for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
      pair = object[index2];
      if (_toString$1.call(pair) !== "[object Object]")
        return false;
      keys = Object.keys(pair);
      if (keys.length !== 1)
        return false;
      result[index2] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data2) {
    if (data2 === null)
      return [];
    var index2, length, pair, keys, result, object = data2;
    result = new Array(object.length);
    for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
      pair = object[index2];
      keys = Object.keys(pair);
      result[index2] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  var pairs = new type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data2) {
    if (data2 === null)
      return true;
    var key, object = data2;
    for (key in object) {
      if (_hasOwnProperty$2.call(object, key)) {
        if (object[key] !== null)
          return false;
      }
    }
    return true;
  }
  function constructYamlSet(data2) {
    return data2 !== null ? data2 : {};
  }
  var set = new type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  var _default = core.extend({
    implicit: [
      timestamp,
      merge
    ],
    explicit: [
      binary,
      omap,
      pairs,
      set
    ]
  });
  var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function is_EOL(c) {
    return c === 10 || c === 13;
  }
  function is_WHITE_SPACE(c) {
    return c === 9 || c === 32;
  }
  function is_WS_OR_EOL(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function is_FLOW_INDICATOR(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    var lc;
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    lc = c | 32;
    if (97 <= lc && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? " " : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(
      (c - 65536 >> 10) + 55296,
      (c - 65536 & 1023) + 56320
    );
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (var i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State$1(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || _default;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.firstTabInLine = -1;
    this.documents = [];
  }
  function generateError(state, message) {
    var mark2 = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      // omit trailing \0
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark2.snippet = snippet(mark2);
    return new exception(message, mark2);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name2, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name2, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty$1.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end2, checkJson) {
    var _position, _length, _character, _result;
    if (start < end2) {
      _result = state.input.slice(start, end2);
      if (checkJson) {
        for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
          _character = _result.charCodeAt(_position);
          if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key, index2, quantity;
    if (!common.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    sourceKeys = Object.keys(source);
    for (index2 = 0, quantity = sourceKeys.length; index2 < quantity; index2 += 1) {
      key = sourceKeys[index2];
      if (!_hasOwnProperty$1.call(destination, key)) {
        destination[key] = source[key];
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    var index2, quantity;
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (index2 = 0, quantity = keyNode.length; index2 < quantity; index2 += 1) {
        if (Array.isArray(keyNode[index2])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index2]) === "[object Object]") {
          keyNode[index2] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (index2 = 0, quantity = valueNode.length; index2 < quantity; index2 += 1) {
          mergeMappings(state, _result, valueNode[index2], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      if (keyNode === "__proto__") {
        Object.defineProperty(_result, keyNode, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: valueNode
        });
      } else {
        _result[keyNode] = valueNode;
      }
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (is_EOL(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    var _position = state.position, ch;
    ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || is_WS_OR_EOL(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
    ch = state.input.charCodeAt(state.position);
    if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
          break;
        }
      } else if (ch === 35) {
        preceding = state.input.charCodeAt(state.position - 1);
        if (is_WS_OR_EOL(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
        break;
      } else if (is_EOL(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!is_WHITE_SPACE(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (is_EOL(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          hexLength = tmp;
          hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (is_WHITE_SPACE(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (is_WHITE_SPACE(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!is_EOL(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (is_EOL(ch)) {
        emptyLines++;
        continue;
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (is_WHITE_SPACE(ch)) {
          atMoreIndented = true;
          state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common.repeat("\n", emptyLines);
        }
      } else {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      captureStart = state.position;
      while (!is_EOL(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      following = state.input.charCodeAt(state.position + 1);
      if (!is_WS_OR_EOL(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
    if (state.firstTabInLine !== -1)
      return false;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      following = state.input.charCodeAt(state.position + 1);
      _line = state.line;
      if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!is_WS_OR_EOL(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 33)
      return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 38)
      return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 42)
      return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (readTagProperty(state) || readAnchorProperty(state)) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        typeList = state.typeMap.multi[state.kind || "fallback"];
        for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveName = state.input.slice(_position, state.position);
      directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !is_EOL(ch));
          break;
        }
        if (is_EOL(ch))
          break;
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0)
        readLineBreak(state);
      if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    } else {
      return;
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    var state = new State$1(input, options);
    var nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll$1(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    var documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (var index2 = 0, length = documents.length; index2 < length; index2 += 1) {
      iterator(documents[index2]);
    }
  }
  function load$1(input, options) {
    var documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new exception("expected a single document in the stream, but found more");
  }
  var loadAll_1 = loadAll$1;
  var load_1 = load$1;
  var loader = {
    loadAll: loadAll_1,
    load: load_1
  };
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_BOM = 65279;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    var result, keys, index2, length, tag, style, type2;
    if (map2 === null)
      return {};
    result = {};
    keys = Object.keys(map2);
    for (index2 = 0, length = keys.length; index2 < length; index2 += 1) {
      tag = keys[index2];
      style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    var string, handle, length;
    string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common.repeat("0", length - string.length) + string;
  }
  var QUOTING_TYPE_SINGLE = 1, QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || _default;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    var ind = common.repeat(" ", spaces), position = 0, next2 = -1, result = "", line, length = string.length;
    while (position < length) {
      next2 = string.indexOf("\n", position);
      if (next2 === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next2 + 1);
        position = next2 + 1;
      }
      if (line.length && line !== "\n")
        result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    var index2, length, type2;
    for (index2 = 0, length = state.implicitTypes.length; index2 < length; index2 += 1) {
      type2 = state.implicitTypes[index2];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev2, inblock) {
    var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (
      // ns-plain-safe
      (inblock ? (
        // c = flow-in
        cIsNsCharOrWhitespace
      ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev2 === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev2) && !isWhitespace(prev2) && c === CHAR_SHARP || prev2 === CHAR_COLON && cIsNsChar
    );
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    var first2 = string.charCodeAt(pos), second;
    if (first2 >= 55296 && first2 <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first2 - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first2;
  }
  function needIndentIndicator(string) {
    var leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  var STYLE_PLAIN = 1, STYLE_SINGLE = 2, STYLE_LITERAL = 3, STYLE_FOLDED = 4, STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    var i2;
    var char = 0;
    var prevChar = null;
    var hasLineBreak = false;
    var hasFoldableLine = false;
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1;
    var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
        char = codePointAt(string, i2);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
        char = codePointAt(string, i2);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i2;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      var indent = state.indent * Math.max(1, level);
      var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
        state.quotingType,
        state.forceQuotes && !iskey,
        inblock
      )) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new exception("impossible error: invalid scalar style");
      }
    }();
  }
  function blockHeader(string, indentPerLevel) {
    var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    var clip = string[string.length - 1] === "\n";
    var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    var chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    var lineRe = /(\n+)([^\n]*)/g;
    var result = function() {
      var nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    }();
    var prevMoreIndented = string[0] === "\n" || string[0] === " ";
    var moreIndented;
    var match;
    while (match = lineRe.exec(string)) {
      var prefix = match[1], line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ")
      return line;
    var breakRe = / [^ ]/g;
    var match;
    var start = 0, end2, curr = 0, next2 = 0;
    var result = "";
    while (match = breakRe.exec(line)) {
      next2 = match.index;
      if (next2 - start > width) {
        end2 = curr > start ? curr : next2;
        result += "\n" + line.slice(start, end2);
        start = end2 + 1;
      }
      curr = next2;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    var result = "";
    var char = 0;
    var escapeSeq;
    for (var i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i2];
        if (char >= 65536)
          result += string[i2 + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    var _result = "", _tag = state.tag, index2, length, value;
    for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
      value = object[index2];
      if (state.replacer) {
        value = state.replacer.call(object, String(index2), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "")
          _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    var _result = "", _tag = state.tag, index2, length, value;
    for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
      value = object[index2];
      if (state.replacer) {
        value = state.replacer.call(object, String(index2), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index2, length, objectKey, objectValue, pairBuffer;
    for (index2 = 0, length = objectKeyList.length; index2 < length; index2 += 1) {
      pairBuffer = "";
      if (_result !== "")
        pairBuffer += ", ";
      if (state.condenseFlow)
        pairBuffer += '"';
      objectKey = objectKeyList[index2];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024)
        pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index2, length, objectKey, objectValue, explicitPair, pairBuffer;
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new exception("sortKeys must be a boolean or a function");
    }
    for (index2 = 0, length = objectKeyList.length; index2 < length; index2 += 1) {
      pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      objectKey = objectKeyList[index2];
      objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    var _result, typeList, index2, length, type2, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index2 = 0, length = typeList.length; index2 < length; index2 += 1) {
      type2 = typeList[index2];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          style = state.styleMap[type2.tag] || type2.defaultStyle;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block2, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    var type2 = _toString.call(state.dump);
    var inblock = block2;
    var tagStr;
    if (block2) {
      block2 = state.flowLevel < 0 || state.flowLevel > level;
    }
    var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block2 && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block2 && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid)
          return false;
        throw new exception("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        tagStr = encodeURI(
          state.tag[0] === "!" ? state.tag.slice(1) : state.tag
        ).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    var objects = [], duplicatesIndexes = [], index2, length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index2 = 0, length = duplicatesIndexes.length; index2 < length; index2 += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index2]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index2, length;
    if (object !== null && typeof object === "object") {
      index2 = objects.indexOf(object);
      if (index2 !== -1) {
        if (duplicatesIndexes.indexOf(index2) === -1) {
          duplicatesIndexes.push(index2);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (index2 = 0, length = object.length; index2 < length; index2 += 1) {
            inspectNode(object[index2], objects, duplicatesIndexes);
          }
        } else {
          objectKeyList = Object.keys(object);
          for (index2 = 0, length = objectKeyList.length; index2 < length; index2 += 1) {
            inspectNode(object[objectKeyList[index2]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump$1(input, options) {
    options = options || {};
    var state = new State(options);
    if (!state.noRefs)
      getDuplicateReferences(input, state);
    var value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true))
      return state.dump + "\n";
    return "";
  }
  var dump_1 = dump$1;
  var dumper = {
    dump: dump_1
  };
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  var Type = type;
  var Schema = schema;
  var FAILSAFE_SCHEMA = failsafe;
  var JSON_SCHEMA = json;
  var CORE_SCHEMA = core;
  var DEFAULT_SCHEMA = _default;
  var load = loader.load;
  var loadAll = loader.loadAll;
  var dump = dumper.dump;
  var YAMLException = exception;
  var types = {
    binary,
    float,
    map,
    null: _null,
    pairs,
    set,
    timestamp,
    bool,
    int,
    merge,
    omap,
    seq,
    str
  };
  var safeLoad = renamed("safeLoad", "load");
  var safeLoadAll = renamed("safeLoadAll", "loadAll");
  var safeDump = renamed("safeDump", "dump");
  var jsYaml = {
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  };
  const yaml = jsYaml;
  const name$4 = "frontmatter";
  const pluginFrontmatter = definePlugin({
    name: name$4,
    transform(transformHooks) {
      transformHooks.beforeParse.tap((md, context) => {
        const { content } = context;
        if (!/^---\r?\n/.test(content))
          return;
        const match = /\n---\r?\n/.exec(content);
        if (!match)
          return;
        const raw = content.slice(4, match.index);
        let frontmatter;
        try {
          frontmatter = yaml.load(raw);
          if (frontmatter == null ? void 0 : frontmatter.markmap) {
            frontmatter.markmap = normalizeMarkmapJsonOptions(
              frontmatter.markmap
            );
          }
        } catch {
          return;
        }
        context.frontmatter = frontmatter;
        context.content = content.slice(match.index + match[0].length);
        context.contentLineOffset = content.slice(0, match.index).split("\n").length + 1;
      });
      return {};
    }
  });
  function normalizeMarkmapJsonOptions(options) {
    if (!options)
      return;
    ["color", "extraJs", "extraCss"].forEach((key) => {
      if (options[key] != null)
        options[key] = normalizeStringArray(options[key]);
    });
    ["duration", "maxWidth", "initialExpandLevel"].forEach((key) => {
      if (options[key] != null)
        options[key] = normalizeNumber(options[key]);
    });
    return options;
  }
  function normalizeStringArray(value) {
    let result;
    if (typeof value === "string")
      result = [value];
    else if (Array.isArray(value))
      result = value.filter((item) => item && typeof item === "string");
    return (result == null ? void 0 : result.length) ? result : void 0;
  }
  function normalizeNumber(value) {
    if (isNaN(+value))
      return;
    return +value;
  }
  function patchJSItem(urlBuilder, item) {
    if (item.type === "script" && item.data.src) {
      return {
        ...item,
        data: {
          ...item.data,
          src: urlBuilder.getFullUrl(item.data.src)
        }
      };
    }
    return item;
  }
  function patchCSSItem(urlBuilder, item) {
    if (item.type === "stylesheet" && item.data.href) {
      return {
        ...item,
        data: {
          ...item.data,
          href: urlBuilder.getFullUrl(item.data.href)
        }
      };
    }
    return item;
  }
  const name$3 = "hljs";
  const preloadScripts$1 = [
    `@highlightjs/cdn-assets@${"11.8.0"}/highlight.min.js`
  ].map((path) => buildJSItem(path));
  const styles$1 = [
    `@highlightjs/cdn-assets@${"11.8.0"}/styles/default.min.css`
  ].map((path) => buildCSSItem(path));
  const config$1 = {
    versions: {
      hljs: "11.8.0"
    },
    preloadScripts: preloadScripts$1,
    styles: styles$1
  };
  const plugin$2 = definePlugin({
    name: name$3,
    config: config$1,
    transform(transformHooks) {
      var _a2, _b, _c;
      let loading;
      const preloadScripts2 = ((_b = (_a2 = plugin$2.config) == null ? void 0 : _a2.preloadScripts) == null ? void 0 : _b.map(
        (item) => patchJSItem(transformHooks.transformer.urlBuilder, item)
      )) || [];
      const autoload = () => {
        loading || (loading = loadJS(preloadScripts2));
        return loading;
      };
      let enableFeature = noop;
      transformHooks.parser.tap((md) => {
        md.set({
          highlight: (str2, language) => {
            enableFeature();
            const { hljs } = window;
            if (hljs) {
              return hljs.highlightAuto(str2, language ? [language] : void 0).value;
            }
            autoload().then(() => {
              transformHooks.retransform.call();
            });
            return str2;
          }
        });
      });
      transformHooks.beforeParse.tap((_, context) => {
        enableFeature = () => {
          context.features[name$3] = true;
        };
      });
      return {
        styles: (_c = plugin$2.config) == null ? void 0 : _c.styles
      };
    }
  });
  const pluginHljs = plugin$2;
  const rkatex = (md, options) => {
    const backslash = "\\";
    const dollar = "$";
    const opts = options || {};
    const delimiter = opts.delimiter || dollar;
    if (delimiter.length !== 1) {
      throw new Error("invalid delimiter");
    }
    const katex = require$$0;
    const renderKatex = (source, displayMode) => katex.renderToString(
      source,
      {
        displayMode,
        throwOnError: false
      }
    );
    const parseBlockKatex = (state, startLine, endLine) => {
      let haveEndMarker = false;
      let pos = state.bMarks[startLine] + state.tShift[startLine];
      let max = state.eMarks[startLine];
      if (pos + 1 > max) {
        return false;
      }
      const marker = state.src.charAt(pos);
      if (marker !== delimiter) {
        return false;
      }
      let mem = pos;
      pos = state.skipChars(pos, marker);
      let len = pos - mem;
      if (len !== 2) {
        return false;
      }
      let nextLine = startLine;
      for (; ; ) {
        ++nextLine;
        if (nextLine >= endLine) {
          break;
        }
        pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];
        if (pos < max && state.tShift[nextLine] < state.blkIndent) {
          break;
        }
        if (state.src.charAt(pos) !== delimiter) {
          continue;
        }
        if (state.tShift[nextLine] - state.blkIndent >= 4) {
          continue;
        }
        pos = state.skipChars(pos, marker);
        if (pos - mem < len) {
          continue;
        }
        pos = state.skipSpaces(pos);
        if (pos < max) {
          continue;
        }
        haveEndMarker = true;
        break;
      }
      len = state.tShift[startLine];
      state.line = nextLine + (haveEndMarker ? 1 : 0);
      const content = state.getLines(startLine + 1, nextLine, len, true).replace(/[ \n]+/g, " ").trim();
      state.tokens.push({
        type: "katex",
        params: null,
        content,
        lines: [startLine, state.line],
        level: state.level,
        block: true
      });
      return true;
    };
    const parseInlineKatex = (state, silent) => {
      const start = state.pos;
      const max = state.posMax;
      let pos = start;
      if (state.src.charAt(pos) !== delimiter) {
        return false;
      }
      ++pos;
      while (pos < max && state.src.charAt(pos) === delimiter) {
        ++pos;
      }
      const marker = state.src.slice(start, pos);
      if (marker.length > 2) {
        return false;
      }
      const spanStart = pos;
      let escapedDepth = 0;
      while (pos < max) {
        const char = state.src.charAt(pos);
        if (char === "{" && (pos == 0 || state.src.charAt(pos - 1) != backslash)) {
          escapedDepth += 1;
        } else if (char === "}" && (pos == 0 || state.src.charAt(pos - 1) != backslash)) {
          escapedDepth -= 1;
          if (escapedDepth < 0) {
            return false;
          }
        } else if (char === delimiter && escapedDepth === 0) {
          const matchStart = pos;
          let matchEnd = pos + 1;
          while (matchEnd < max && state.src.charAt(matchEnd) === delimiter) {
            ++matchEnd;
          }
          if (matchEnd - matchStart === marker.length) {
            if (!silent) {
              const content = state.src.slice(spanStart, matchStart).replace(/[ \n]+/g, " ").trim();
              state.push({ type: "katex", content, block: marker.length > 1, level: state.level });
            }
            state.pos = matchEnd;
            return true;
          }
        }
        pos += 1;
      }
      if (!silent) {
        state.pending += marker;
      }
      state.pos += marker.length;
      return true;
    };
    md.inline.ruler.push("katex", parseInlineKatex, options);
    md.block.ruler.push("katex", parseBlockKatex, options);
    md.renderer.rules.katex = (tokens, idx) => renderKatex(tokens[idx].content, tokens[idx].block);
    md.renderer.rules.katex.delimiter = delimiter;
  };
  var remarkableKatex = rkatex;
  const remarkableKatex$1 = /* @__PURE__ */ getDefaultExportFromCjs(remarkableKatex);
  const name$2 = "katex";
  const preloadScripts = [
    `katex@${"0.16.8"}/dist/katex.min.js`
  ].map((path) => buildJSItem(path));
  const webfontloader = buildJSItem(
    `webfontloader@${"1.6.28"}/webfontloader.js`
  );
  webfontloader.data.defer = true;
  const styles = [`katex@${"0.16.8"}/dist/katex.min.css`].map(
    (path) => buildCSSItem(path)
  );
  const config = {
    versions: {
      katex: "0.16.8",
      webfontloader: "1.6.28"
    },
    preloadScripts,
    scripts: [
      {
        type: "iife",
        data: {
          fn: (getMarkmap) => {
            window.WebFontConfig = {
              custom: {
                families: [
                  "KaTeX_AMS",
                  "KaTeX_Caligraphic:n4,n7",
                  "KaTeX_Fraktur:n4,n7",
                  "KaTeX_Main:n4,n7,i4,i7",
                  "KaTeX_Math:i4,i7",
                  "KaTeX_Script",
                  "KaTeX_SansSerif:n4,n7,i4",
                  "KaTeX_Size1",
                  "KaTeX_Size2",
                  "KaTeX_Size3",
                  "KaTeX_Size4",
                  "KaTeX_Typewriter"
                ]
              },
              active: () => {
                getMarkmap().refreshHook.call();
              }
            };
          },
          getParams({ getMarkmap }) {
            return [getMarkmap];
          }
        }
      },
      webfontloader
    ],
    styles
  };
  function addDefaultVersions(paths, name2, version) {
    return paths.map((path) => {
      if (typeof path === "string" && !path.includes("://")) {
        if (!path.startsWith("npm:")) {
          path = `npm:${path}`;
        }
        const prefixLength = 4 + name2.length;
        if (path.startsWith(`npm:${name2}/`)) {
          path = `${path.slice(0, prefixLength)}@${version}${path.slice(
            prefixLength
          )}`;
        }
      }
      return path;
    });
  }
  const plugin$1 = definePlugin({
    name: name$2,
    config,
    transform(transformHooks) {
      var _a2, _b, _c, _d;
      let loading;
      const preloadScripts2 = ((_b = (_a2 = plugin$1.config) == null ? void 0 : _a2.preloadScripts) == null ? void 0 : _b.map(
        (item) => patchJSItem(transformHooks.transformer.urlBuilder, item)
      )) || [];
      const autoload = () => {
        loading || (loading = loadJS(preloadScripts2));
        return loading;
      };
      const renderKatex = (source, displayMode) => {
        const { katex } = window;
        if (katex) {
          return katex.renderToString(source, {
            displayMode,
            throwOnError: false
          });
        }
        autoload().then(() => {
          transformHooks.retransform.call();
        });
        return source;
      };
      let enableFeature = noop;
      transformHooks.parser.tap((md) => {
        md.use(remarkableKatex$1);
        md.renderer.rules.katex = (tokens, idx) => {
          enableFeature();
          const result = renderKatex(tokens[idx].content, !!tokens[idx].block);
          return result;
        };
      });
      transformHooks.beforeParse.tap((_, context) => {
        enableFeature = () => {
          context.features[name$2] = true;
        };
      });
      transformHooks.afterParse.tap((_, context) => {
        var _a3;
        const markmap = (_a3 = context.frontmatter) == null ? void 0 : _a3.markmap;
        if (markmap) {
          ["extraJs", "extraCss"].forEach((key) => {
            var _a4, _b2;
            const value = markmap[key];
            if (value) {
              markmap[key] = addDefaultVersions(
                value,
                name$2,
                ((_b2 = (_a4 = plugin$1.config) == null ? void 0 : _a4.versions) == null ? void 0 : _b2.katex) || ""
              );
            }
          });
        }
      });
      return {
        styles: (_c = plugin$1.config) == null ? void 0 : _c.styles,
        scripts: (_d = plugin$1.config) == null ? void 0 : _d.scripts
      };
    }
  });
  const pluginKatex = plugin$1;
  const name$1 = "npmUrl";
  const pluginNpmUrl = definePlugin({
    name: name$1,
    transform(transformHooks) {
      transformHooks.afterParse.tap((_, context) => {
        const { frontmatter } = context;
        const markmap = frontmatter == null ? void 0 : frontmatter.markmap;
        if (markmap) {
          ["extraJs", "extraCss"].forEach((key) => {
            const value = markmap[key];
            if (value) {
              markmap[key] = value.map((path) => {
                if (path.startsWith("npm:")) {
                  return transformHooks.transformer.urlBuilder.getFullUrl(
                    path.slice(4)
                  );
                }
                return path;
              });
            }
          });
        }
      });
      return {};
    }
  });
  const name = "sourceLines";
  const plugin = definePlugin({
    name,
    transform(transformHooks) {
      transformHooks.parser.tap((md) => {
        Object.entries(md.renderer.rules).forEach(([key, value]) => {
          if (typeof value === "function") {
            md.renderer.rules[key] = patchRule(value);
          } else {
            Object.entries(value).forEach(([k, v]) => {
              value[k] = patchRule(v);
            });
          }
        });
      });
      return {};
    }
  });
  function patchRule(rule, _key) {
    return wrapFunction(rule, (render2, tokens, idx, ...rest) => {
      let html2 = render2(tokens, idx, ...rest);
      const { lines } = tokens[idx];
      if (lines) {
        html2 = html2.replace(
          /^<[\w-]+/,
          (m) => `${m} data-lines="${lines.join(",")}"`
        );
      }
      return html2;
    });
  }
  const pluginSourceLines = plugin;
  const plugins = [
    pluginFrontmatter,
    pluginKatex,
    pluginHljs,
    pluginNpmUrl,
    pluginCheckbox,
    pluginSourceLines
  ];
  const builtInPlugins = plugins;
  function cleanNode(node) {
    while (!node.content && node.children.length === 1) {
      node = node.children[0];
    }
    while (node.children.length === 1 && !node.children[0].content) {
      node = {
        ...node,
        children: node.children[0].children
      };
    }
    return {
      ...node,
      children: node.children.map(cleanNode)
    };
  }
  class Transformer {
    constructor(plugins2 = builtInPlugins) {
      this.assetsMap = {};
      this.urlBuilder = new UrlBuilder();
      this.hooks = createTransformHooks(this);
      this.plugins = plugins2.map(
        (plugin2) => typeof plugin2 === "function" ? plugin2() : plugin2
      );
      const assetsMap = {};
      for (const { name: name2, transform } of this.plugins) {
        assetsMap[name2] = transform(this.hooks);
      }
      this.assetsMap = assetsMap;
      const md = new Remarkable("full", {
        html: true,
        breaks: true,
        maxNesting: Infinity
      });
      md.renderer.rules.htmltag = wrapFunction(
        md.renderer.rules.htmltag,
        (render2, ...args) => {
          const result = render2(...args);
          this.hooks.htmltag.call({ args, result });
          return result;
        }
      );
      this.md = md;
      this.hooks.parser.call(md);
    }
    transform(content, opts) {
      var _a2, _b;
      const context = {
        content,
        features: {},
        contentLineOffset: 0
      };
      this.hooks.beforeParse.call(this.md, context);
      const html2 = this.md.render(context.content, {});
      this.hooks.afterParse.call(this.md, context);
      const root2 = cleanNode(
        buildTree(html2, {
          ...(_b = (_a2 = context.frontmatter) == null ? void 0 : _a2.markmap) == null ? void 0 : _b.htmlParser,
          ...opts
        })
      );
      return { ...context, root: root2 };
    }
    /**
     * Get all assets from enabled plugins or filter them by plugin names as keys.
     */
    getAssets(keys) {
      const styles2 = [];
      const scripts = [];
      keys ?? (keys = this.plugins.map((plugin2) => plugin2.name));
      for (const assets of keys.map((key) => this.assetsMap[key])) {
        if (assets) {
          if (assets.styles)
            styles2.push(...assets.styles);
          if (assets.scripts)
            scripts.push(...assets.scripts);
        }
      }
      return {
        styles: styles2.map((item) => patchCSSItem(this.urlBuilder, item)),
        scripts: scripts.map((item) => patchJSItem(this.urlBuilder, item))
      };
    }
    /**
     * Get used assets by features object returned by `transform`.
     */
    getUsedAssets(features) {
      const keys = this.plugins.map((plugin2) => plugin2.name).filter((name2) => features[name2]);
      return this.getAssets(keys);
    }
  }
  const transformerVersions = {
    "markmap-lib": "0.16.1"
  };
  exports.Transformer = Transformer;
  exports.builtInPlugins = builtInPlugins;
  exports.transformerVersions = transformerVersions;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
})(this.markmap = this.markmap || {}, window.katex);
