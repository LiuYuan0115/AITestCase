export class ContentSecurityPolicy {
  static DIRECTIVE_ORDER = {
    "default-src": 0,
    "script-src": 1,
    "object-src": 2
  };
  data;
  constructor(csp) {
    if (csp) {
      const sections = csp.split(";").map((section) => section.trim());
      this.data = sections.reduce((data, section) => {
        const [key, ...values] = section.split(" ").map((item) => item.trim());
        if (key) data[key] = values;
        return data;
      }, {});
    } else {
      this.data = {};
    }
  }
  /**
   * Ensure a set of values are listed under a directive.
   */
  add(directive, ...newValues) {
    const values = this.data[directive] ?? [];
    newValues.forEach((newValue) => {
      if (!values.includes(newValue)) values.push(newValue);
    });
    this.data[directive] = values;
    return this;
  }
  toString() {
    const directives = Object.entries(this.data).sort(([l], [r]) => {
      const lo = ContentSecurityPolicy.DIRECTIVE_ORDER[l] ?? 2;
      const ro = ContentSecurityPolicy.DIRECTIVE_ORDER[r] ?? 2;
      return lo - ro;
    });
    return directives.map((entry) => entry.flat().join(" ")).join("; ") + ";";
  }
}
