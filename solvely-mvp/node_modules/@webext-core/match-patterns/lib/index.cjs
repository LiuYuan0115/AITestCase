"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  InvalidMatchPattern: () => InvalidMatchPattern,
  MatchPattern: () => MatchPattern
});
module.exports = __toCommonJS(src_exports);
var _MatchPattern = class {
  constructor(matchPattern) {
    if (matchPattern === "<all_urls>") {
      this.isAllUrls = true;
      this.protocolMatches = [..._MatchPattern.PROTOCOLS];
      this.hostnameMatch = "*";
      this.pathnameMatch = "*";
    } else {
      const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
      if (groups == null)
        throw new InvalidMatchPattern(matchPattern, "Incorrect format");
      const [_, protocol, hostname, pathname] = groups;
      validateProtocol(matchPattern, protocol);
      validateHostname(matchPattern, hostname);
      validatePathname(matchPattern, pathname);
      this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
      this.hostnameMatch = hostname;
      this.pathnameMatch = pathname;
    }
  }
  includes(url) {
    if (this.isAllUrls)
      return true;
    const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
    return !!this.protocolMatches.find((protocol) => {
      if (protocol === "http")
        return this.isHttpMatch(u);
      if (protocol === "https")
        return this.isHttpsMatch(u);
      if (protocol === "file")
        return this.isFileMatch(u);
      if (protocol === "ftp")
        return this.isFtpMatch(u);
      if (protocol === "urn")
        return this.isUrnMatch(u);
    });
  }
  isHttpMatch(url) {
    return url.protocol === "http:" && this.isHostPathMatch(url);
  }
  isHttpsMatch(url) {
    return url.protocol === "https:" && this.isHostPathMatch(url);
  }
  isHostPathMatch(url) {
    if (!this.hostnameMatch || !this.pathnameMatch)
      return false;
    const hostnameMatchRegexs = [
      this.convertPatternToRegex(this.hostnameMatch),
      this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
    ];
    const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
    return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
  }
  isFileMatch(url) {
    throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
  }
  isFtpMatch(url) {
    throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
  }
  isUrnMatch(url) {
    throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
  }
  convertPatternToRegex(pattern) {
    const escaped = this.escapeForRegex(pattern);
    const starsReplaced = escaped.replace(/\\\*/g, ".*");
    return RegExp(`^${starsReplaced}$`);
  }
  escapeForRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
};
var MatchPattern = _MatchPattern;
MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
var InvalidMatchPattern = class extends Error {
  constructor(matchPattern, reason) {
    super(`Invalid match pattern "${matchPattern}": ${reason}`);
  }
};
function validateProtocol(matchPattern, protocol) {
  if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
    throw new InvalidMatchPattern(
      matchPattern,
      `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
    );
}
function validateHostname(matchPattern, hostname) {
  if (hostname.includes(":"))
    throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
  if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
    throw new InvalidMatchPattern(
      matchPattern,
      `If using a wildcard (*), it must go at the start of the hostname`
    );
}
function validatePathname(matchPattern, pathname) {
  return;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InvalidMatchPattern,
  MatchPattern
});
