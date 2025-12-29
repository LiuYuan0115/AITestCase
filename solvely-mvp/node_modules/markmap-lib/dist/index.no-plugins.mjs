import { Hook, UrlBuilder, wrapFunction } from "markmap-common";
import { buildTree } from "markmap-html-parser";
import { Remarkable } from "remarkable";
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
const builtInPlugins = [];
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
  constructor(plugins = builtInPlugins) {
    this.assetsMap = {};
    this.urlBuilder = new UrlBuilder();
    this.hooks = createTransformHooks(this);
    this.plugins = plugins.map(
      (plugin) => typeof plugin === "function" ? plugin() : plugin
    );
    const assetsMap = {};
    for (const { name, transform } of this.plugins) {
      assetsMap[name] = transform(this.hooks);
    }
    this.assetsMap = assetsMap;
    const md = new Remarkable("full", {
      html: true,
      breaks: true,
      maxNesting: Infinity
    });
    md.renderer.rules.htmltag = wrapFunction(
      md.renderer.rules.htmltag,
      (render, ...args) => {
        const result = render(...args);
        this.hooks.htmltag.call({ args, result });
        return result;
      }
    );
    this.md = md;
    this.hooks.parser.call(md);
  }
  transform(content, opts) {
    var _a, _b;
    const context = {
      content,
      features: {},
      contentLineOffset: 0
    };
    this.hooks.beforeParse.call(this.md, context);
    const html = this.md.render(context.content, {});
    this.hooks.afterParse.call(this.md, context);
    const root = cleanNode(
      buildTree(html, {
        ...(_b = (_a = context.frontmatter) == null ? void 0 : _a.markmap) == null ? void 0 : _b.htmlParser,
        ...opts
      })
    );
    return { ...context, root };
  }
  /**
   * Get all assets from enabled plugins or filter them by plugin names as keys.
   */
  getAssets(keys) {
    const styles = [];
    const scripts = [];
    keys ?? (keys = this.plugins.map((plugin) => plugin.name));
    for (const assets of keys.map((key) => this.assetsMap[key])) {
      if (assets) {
        if (assets.styles)
          styles.push(...assets.styles);
        if (assets.scripts)
          scripts.push(...assets.scripts);
      }
    }
    return {
      styles: styles.map((item) => patchCSSItem(this.urlBuilder, item)),
      scripts: scripts.map((item) => patchJSItem(this.urlBuilder, item))
    };
  }
  /**
   * Get used assets by features object returned by `transform`.
   */
  getUsedAssets(features) {
    const keys = this.plugins.map((plugin) => plugin.name).filter((name) => features[name]);
    return this.getAssets(keys);
  }
}
const transformerVersions = {
  "markmap-lib": "0.16.1"
};
export {
  Transformer,
  builtInPlugins,
  transformerVersions
};
