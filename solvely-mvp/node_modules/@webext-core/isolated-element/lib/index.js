var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
import isPotentialCustomElementName from "is-potential-custom-element-name";
function createIsolatedElement(options) {
  return __async(this, null, function* () {
    const { name, mode = "closed", css, isolateEvents = false } = options;
    if (!isPotentialCustomElementName(name)) {
      throw Error(
        `"${name}" is not a valid custom element name. It must be two words and kebab-case, with a few exceptions. See spec for more details: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name`
      );
    }
    const parentElement = document.createElement(name);
    const shadow = parentElement.attachShadow({ mode });
    const isolatedElement = document.createElement("html");
    const body = document.createElement("body");
    const head = document.createElement("head");
    if (css) {
      const style = document.createElement("style");
      if ("url" in css) {
        style.textContent = yield fetch(css.url).then((res) => res.text());
      } else {
        style.textContent = css.textContent;
      }
      head.appendChild(style);
    }
    isolatedElement.appendChild(head);
    isolatedElement.appendChild(body);
    shadow.appendChild(isolatedElement);
    if (isolateEvents) {
      const eventTypes = Array.isArray(isolateEvents) ? isolateEvents : ["keydown", "keyup", "keypress"];
      eventTypes.forEach((eventType) => {
        body.addEventListener(eventType, (e) => e.stopPropagation());
      });
    }
    return {
      parentElement,
      shadow,
      isolatedElement: body
    };
  });
}
export {
  createIsolatedElement
};
