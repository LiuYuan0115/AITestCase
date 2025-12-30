"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const markmapCommon = require("markmap-common");
const yaml = require("js-yaml");
const hljs = require("highlight.js");
const remarkableKatex = require("remarkable-katex");
function createTransformHooks(transformer) {
  return {
    transformer,
    parser: new markmapCommon.Hook(),
    beforeParse: new markmapCommon.Hook(),
    afterParse: new markmapCommon.Hook(),
    htmltag: new markmapCommon.Hook(),
    retransform: new markmapCommon.Hook()
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
          for (let i = 2; i < state.tokens.length; i += 1) {
            const token = state.tokens[i];
            if (token.type === "inline" && token.content) {
              const prevType = state.tokens[i - 1].type;
              const prevPrevType = state.tokens[i - 2].type;
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
const name$3 = "hljs";
const preloadScripts$1 = [
  `@highlightjs/cdn-assets@${"11.8.0"}/highlight.min.js`
].map((path) => markmapCommon.buildJSItem(path));
const styles$1 = [
  `@highlightjs/cdn-assets@${"11.8.0"}/styles/default.min.css`
].map((path) => markmapCommon.buildCSSItem(path));
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
    var _a;
    let enableFeature = markmapCommon.noop;
    transformHooks.parser.tap((md) => {
      md.set({
        highlight: (str, language) => {
          enableFeature();
          return hljs.highlightAuto(str, language ? [language] : void 0).value;
        }
      });
    });
    transformHooks.beforeParse.tap((_, context) => {
      enableFeature = () => {
        context.features[name$3] = true;
      };
    });
    return {
      styles: (_a = plugin$2.config) == null ? void 0 : _a.styles
    };
  }
});
const pluginHljs = plugin$2;
const name$2 = "katex";
const preloadScripts = [
  `katex@${"0.16.8"}/dist/katex.min.js`
].map((path) => markmapCommon.buildJSItem(path));
const webfontloader = markmapCommon.buildJSItem(
  `webfontloader@${"1.6.28"}/webfontloader.js`
);
webfontloader.data.defer = true;
const styles = [`katex@${"0.16.8"}/dist/katex.min.css`].map(
  (path) => markmapCommon.buildCSSItem(path)
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
const plugin$1 = definePlugin({
  name: name$2,
  config,
  transform(transformHooks) {
    var _a, _b;
    let enableFeature = markmapCommon.noop;
    transformHooks.parser.tap((md) => {
      md.use(remarkableKatex);
      md.renderer.rules.katex = markmapCommon.wrapFunction(
        md.renderer.rules.katex,
        (render, ...args) => {
          enableFeature();
          return render(...args);
        }
      );
    });
    transformHooks.beforeParse.tap((_, context) => {
      enableFeature = () => {
        context.features[name$2] = true;
      };
    });
    return {
      styles: (_a = plugin$1.config) == null ? void 0 : _a.styles,
      scripts: (_b = plugin$1.config) == null ? void 0 : _b.scripts
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
  return markmapCommon.wrapFunction(rule, (render, tokens, idx, ...rest) => {
    let html = render(tokens, idx, ...rest);
    const { lines } = tokens[idx];
    if (lines) {
      html = html.replace(
        /^<[\w-]+/,
        (m) => `${m} data-lines="${lines.join(",")}"`
      );
    }
    return html;
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
exports.createTransformHooks = createTransformHooks;
exports.definePlugin = definePlugin;
exports.pluginCheckbox = pluginCheckbox;
exports.pluginFrontmatter = pluginFrontmatter;
exports.pluginHljs = pluginHljs;
exports.pluginKatex = pluginKatex;
exports.pluginNpmUrl = pluginNpmUrl;
exports.pluginSourceLines = pluginSourceLines;
exports.plugins = plugins;
