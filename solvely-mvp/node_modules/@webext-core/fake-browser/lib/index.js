var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// src/utils/defineEventWithTrigger.ts
function defineEventWithTrigger() {
  const listeners = [];
  return {
    hasListener(callback) {
      return listeners.includes(callback);
    },
    hasListeners() {
      return listeners.length > 0;
    },
    addListener(callback) {
      listeners.push(callback);
    },
    removeListener(callback) {
      const index = listeners.indexOf(callback);
      if (index >= 0)
        listeners.splice(index, 1);
    },
    removeAllListeners() {
      listeners.length = 0;
    },
    trigger(...args) {
      return __async(this, null, function* () {
        return yield Promise.all(listeners.map((l) => l(...args)));
      });
    }
  };
}

// src/apis/alarms.ts
var alarmList = [];
var onAlarm = defineEventWithTrigger();
var alarms = {
  resetState() {
    alarmList.length = 0;
    onAlarm.removeAllListeners();
  },
  clear(name) {
    return __async(this, null, function* () {
      name != null ? name : name = "";
      const index = alarmList.findIndex((alarm) => alarm.name === name);
      if (index >= 0) {
        alarmList.splice(index, 1);
        return true;
      }
      return false;
    });
  },
  clearAll() {
    return __async(this, null, function* () {
      const hasAlarms = alarmList.length > 0;
      alarmList.length = 0;
      return hasAlarms;
    });
  },
  // @ts-expect-error: multiple implementations
  create(arg0, arg1) {
    var _a, _b;
    let name;
    let alarmInfo;
    if (typeof arg0 === "object") {
      name = "";
      alarmInfo = arg0;
    } else {
      name = arg0 != null ? arg0 : "";
      alarmInfo = arg1;
    }
    const i = alarmList.findIndex((alarm) => alarm.name === name);
    if (i >= 0)
      alarmList.splice(i, 1);
    alarmList.push({
      name,
      scheduledTime: (_b = alarmInfo.when) != null ? _b : Date.now() + ((_a = alarmInfo.delayInMinutes) != null ? _a : 0) * 6e4,
      periodInMinutes: alarmInfo.periodInMinutes
    });
  },
  get(name) {
    return __async(this, null, function* () {
      name != null ? name : name = "";
      return alarmList.find((alarm) => alarm.name === name);
    });
  },
  getAll() {
    return __async(this, null, function* () {
      return alarmList;
    });
  },
  onAlarm
};

// src/apis/notifications.ts
var notificationMap = {};
var onClosed = defineEventWithTrigger();
var onClicked = defineEventWithTrigger();
var onButtonClicked = defineEventWithTrigger();
var onShown = defineEventWithTrigger();
function create(arg1, arg2) {
  return __async(this, null, function* () {
    let id;
    let options;
    if (arg2 == null) {
      id = String(Math.random());
      options = arg1;
    } else {
      id = arg1;
      options = arg2;
    }
    if (notificationExists(id))
      yield notifications.clear(id);
    notificationMap[id] = options;
    return id;
  });
}
function notificationExists(id) {
  return !!notificationMap[id];
}
var notifications = {
  resetState() {
    notificationMap = {};
    onClosed.removeAllListeners();
    onClicked.removeAllListeners();
    onButtonClicked.removeAllListeners();
    onShown.removeAllListeners();
  },
  create,
  clear(notificationId) {
    return __async(this, null, function* () {
      const wasCleared = notificationExists(notificationId);
      delete notificationMap[notificationId];
      return wasCleared;
    });
  },
  getAll() {
    return __async(this, null, function* () {
      return notificationMap;
    });
  },
  onClosed,
  onClicked,
  onButtonClicked,
  onShown
};

// src/apis/runtime.ts
var onMessage = defineEventWithTrigger();
var onInstalled = defineEventWithTrigger();
var onStartup = defineEventWithTrigger();
var onSuspend = defineEventWithTrigger();
var onSuspendCanceled = defineEventWithTrigger();
var onUpdateAvailable = defineEventWithTrigger();
var TEST_ID = "test-extension-id";
var runtime = {
  resetState() {
    onMessage.removeAllListeners();
    onInstalled.removeAllListeners();
    onStartup.removeAllListeners();
    onSuspend.removeAllListeners();
    onSuspendCanceled.removeAllListeners();
    onUpdateAvailable.removeAllListeners();
    runtime.id = TEST_ID;
  },
  id: TEST_ID,
  getURL(path) {
    return `chrome-extension://${runtime.id}/${path.replace(/^\//, "")}`;
  },
  onInstalled,
  onMessage,
  onStartup,
  onSuspend,
  onSuspendCanceled,
  onUpdateAvailable,
  // @ts-expect-error: Method has overrides :/
  sendMessage(_0, _1, _2) {
    return __async(this, arguments, function* (arg0, arg1, arg2) {
      let extensionId;
      let message;
      let options;
      if (arguments.length === 1 || arguments.length === 2 && typeof arg1 === "object") {
        extensionId = void 0;
        message = arg0;
        options = arg2;
      } else {
        extensionId = arg0;
        message = arg1;
        options = arg2;
      }
      if (!onMessage.hasListeners())
        throw Error("No listeners available");
      const sender = {};
      const res = yield onMessage.trigger(message, sender);
      return res.find((r) => !!r);
    });
  }
};

// src/apis/storage.ts
var globalOnChanged = defineEventWithTrigger();
function defineStorageArea(area) {
  const data = {};
  const onChanged = defineEventWithTrigger();
  function getKeyList(keys) {
    return Array.isArray(keys) ? keys : [keys];
  }
  return {
    resetState() {
      onChanged.removeAllListeners();
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
    clear() {
      return __async(this, null, function* () {
        var _a2;
        const changes = {};
        for (const key of Object.keys(data)) {
          const oldValue = (_a2 = data[key]) != null ? _a2 : null;
          const newValue = null;
          changes[key] = { oldValue, newValue };
          delete data[key];
        }
        yield onChanged.trigger(changes);
        yield globalOnChanged.trigger(changes, area);
      });
    },
    get(keys) {
      return __async(this, null, function* () {
        if (keys == null)
          return __spreadValues({}, data);
        const res = {};
        if (typeof keys === "object" && !Array.isArray(keys)) {
          Object.keys(keys).forEach((key) => {
            var _a2;
            return res[key] = (_a2 = data[key]) != null ? _a2 : keys[key];
          });
        } else {
          getKeyList(keys).forEach((key) => res[key] = data[key]);
        }
        return res;
      });
    },
    remove(keys) {
      return __async(this, null, function* () {
        var _a2;
        const changes = {};
        for (const key of getKeyList(keys)) {
          const oldValue = (_a2 = data[key]) != null ? _a2 : null;
          const newValue = null;
          changes[key] = { oldValue, newValue };
          delete data[key];
        }
        yield onChanged.trigger(changes);
        yield globalOnChanged.trigger(changes, area);
      });
    },
    set(items) {
      return __async(this, null, function* () {
        var _a2;
        const changes = {};
        for (const [key, newValue] of Object.entries(JSON.parse(JSON.stringify(items)))) {
          if (newValue === void 0)
            continue;
          const oldValue = (_a2 = data[key]) != null ? _a2 : null;
          changes[key] = { oldValue, newValue };
          if (newValue == null)
            delete data[key];
          else
            data[key] = newValue;
        }
        yield onChanged.trigger(changes);
        yield globalOnChanged.trigger(changes, area);
      });
    },
    onChanged
  };
}
var localStorage = __spreadProps(__spreadValues({}, defineStorageArea("local")), {
  QUOTA_BYTES: 5242880
});
var managedStorage = __spreadProps(__spreadValues({}, defineStorageArea("managed")), {
  QUOTA_BYTES: 5242880
});
var sessionStorage = __spreadProps(__spreadValues({}, defineStorageArea("session")), {
  QUOTA_BYTES: 10485760
});
var syncStorage = __spreadProps(__spreadValues({}, defineStorageArea("sync")), {
  MAX_ITEMS: 512,
  MAX_WRITE_OPERATIONS_PER_HOUR: 1800,
  MAX_WRITE_OPERATIONS_PER_MINUTE: 120,
  QUOTA_BYTES: 102400,
  QUOTA_BYTES_PER_ITEM: 8192,
  getBytesInUse: () => {
    throw Error("Browser.storage.sync.getBytesInUse not implemented.");
  }
});
var storage = {
  resetState() {
    localStorage.resetState();
    managedStorage.resetState();
    sessionStorage.resetState();
    syncStorage.resetState();
    globalOnChanged.removeAllListeners();
  },
  local: localStorage,
  managed: managedStorage,
  session: sessionStorage,
  sync: syncStorage,
  onChanged: globalOnChanged
};

// src/apis/windows.ts
var onCreated = defineEventWithTrigger();
var onRemoved = defineEventWithTrigger();
var onFocusChanged = defineEventWithTrigger();
var DEFAULT_WINDOW = {
  id: 0,
  alwaysOnTop: false,
  incognito: false
};
var DEFAULT_NEXT_WINDOW_ID = 1;
var windowList = [DEFAULT_WINDOW];
var focusedWindowId;
var lastFocusedWindowId;
var nextWindowId = DEFAULT_NEXT_WINDOW_ID;
function setFocusedWindowId(id) {
  lastFocusedWindowId = focusedWindowId;
  focusedWindowId = id;
}
function getNextWindowId() {
  const id = nextWindowId;
  nextWindowId++;
  return id;
}
function mapWindow(window, getInfo) {
  return __spreadProps(__spreadValues({}, window), {
    tabs: (getInfo == null ? void 0 : getInfo.populate) ? tabList.filter((tab) => tab.windowId === window.id).map(mapTab) : void 0,
    focused: window.id === focusedWindowId
  });
}
function mapCreateType(type) {
  if (type == null)
    return void 0;
  if (type == "detached_panel")
    return "panel";
  return type;
}
var windows = {
  resetState() {
    windowList.length = 1;
    windowList[0] = DEFAULT_WINDOW;
    focusedWindowId = void 0;
    lastFocusedWindowId = void 0;
    nextWindowId = DEFAULT_NEXT_WINDOW_ID;
    onCreated.removeAllListeners();
    onRemoved.removeAllListeners();
    onFocusChanged.removeAllListeners();
  },
  get(windowId, getInfo) {
    return __async(this, null, function* () {
      const window = windowList.find((window2) => window2.id === windowId);
      if (!window)
        return void 0;
      return mapWindow(window, getInfo);
    });
  },
  getCurrent(getInfo) {
    if (focusedWindowId == null)
      return void 0;
    return windows.get(focusedWindowId, getInfo);
  },
  getLastFocused(getInfo) {
    if (lastFocusedWindowId == null)
      return void 0;
    return windows.get(lastFocusedWindowId, getInfo);
  },
  getAll(getInfo) {
    return __async(this, null, function* () {
      return windowList.map((window) => mapWindow(window, getInfo));
    });
  },
  create(createData) {
    return __async(this, null, function* () {
      var _a;
      const newWindow = {
        id: getNextWindowId(),
        alwaysOnTop: false,
        incognito: (_a = createData == null ? void 0 : createData.incognito) != null ? _a : false,
        height: createData == null ? void 0 : createData.height,
        left: createData == null ? void 0 : createData.left,
        state: createData == null ? void 0 : createData.state,
        top: createData == null ? void 0 : createData.top,
        type: mapCreateType(createData == null ? void 0 : createData.type),
        width: createData == null ? void 0 : createData.width
      };
      windowList.push(newWindow);
      if (createData == null ? void 0 : createData.focused)
        setFocusedWindowId(newWindow.id);
      const fullWindow = mapWindow(newWindow);
      yield onCreated.trigger(fullWindow);
      if (createData == null ? void 0 : createData.focused)
        onFocusChanged.trigger(fullWindow.id);
      return fullWindow;
    });
  },
  update(windowId, updateInfo) {
    return __async(this, null, function* () {
      const window = windowList.find((window2) => window2.id === windowId);
      if (!window)
        return void 0;
      return mapWindow(window);
    });
  },
  remove(windowId) {
    return __async(this, null, function* () {
      const index = windowList.findIndex((window) => window.id === windowId);
      if (index < 0)
        return;
      windowList.splice(index, 1);
    });
  },
  onCreated,
  onRemoved,
  onFocusChanged
};

// src/apis/tabs.ts
var onActivated = defineEventWithTrigger();
var onCreated2 = defineEventWithTrigger();
var onUpdated = defineEventWithTrigger();
var onHighlighted = defineEventWithTrigger();
var onRemoved2 = defineEventWithTrigger();
var DEFAULT_TAB = {
  id: 0,
  index: 0,
  highlighted: false,
  incognito: false,
  pinned: false
};
var DEFAULT_NEXT_TAB_ID = 1;
var tabList = [DEFAULT_TAB];
var activeTabId;
var nextTabId = DEFAULT_NEXT_TAB_ID;
function setActiveTabId(id) {
  activeTabId = id;
}
function getNextTabId() {
  const id = nextTabId;
  nextTabId++;
  return id;
}
function mapTab(tab) {
  return __spreadProps(__spreadValues({}, tab), {
    active: activeTabId === tab.id
  });
}
var tabs = {
  resetState() {
    tabList.length = 1;
    tabList[0] = DEFAULT_TAB;
    activeTabId = void 0;
    nextTabId = DEFAULT_NEXT_TAB_ID;
    onActivated.removeAllListeners();
    onCreated2.removeAllListeners();
    onUpdated.removeAllListeners();
    onHighlighted.removeAllListeners();
    onRemoved2.removeAllListeners();
  },
  get(tabId) {
    return __async(this, null, function* () {
      const tab = tabList.find((tab2) => tab2.id === tabId);
      if (!tab)
        return void 0;
      return mapTab(tab);
    });
  },
  getCurrent() {
    if (activeTabId == null)
      return void 0;
    return tabs.get(activeTabId);
  },
  create(createProperties) {
    return __async(this, null, function* () {
      var _a, _b, _c;
      const window = createProperties.windowId ? yield windows.get(createProperties.windowId, { populate: true }) : yield windows.getCurrent({ populate: true });
      const newTab = {
        highlighted: false,
        incognito: false,
        index: (_b = (_a = window.tabs) == null ? void 0 : _a.length) != null ? _b : 0,
        pinned: (_c = createProperties.pinned) != null ? _c : false,
        windowId: window.id,
        id: getNextTabId(),
        url: createProperties.url
      };
      const fullTab = mapTab(newTab);
      yield onCreated2.trigger(fullTab);
      return fullTab;
    });
  },
  duplicate(tabId, duplicateProperties) {
    return __async(this, null, function* () {
      const tab = yield tabs.get(tabId);
      const newTab = __spreadProps(__spreadValues({}, tab), {
        id: getNextTabId()
      });
      const prevActiveTabId = activeTabId;
      if (duplicateProperties == null ? void 0 : duplicateProperties.active) {
        setActiveTabId(newTab.id);
      }
      const fullTab = mapTab(newTab);
      yield onCreated2.trigger(fullTab);
      if (duplicateProperties == null ? void 0 : duplicateProperties.active)
        yield onActivated.trigger({
          tabId: fullTab.id,
          windowId: fullTab.windowId,
          previousTabId: prevActiveTabId
        });
      return fullTab;
    });
  },
  query(queryInfo) {
    return __async(this, null, function* () {
      const currentWindow = yield windows.getCurrent();
      const lastFocusedWindow = yield windows.getLastFocused();
      return tabList.filter((tab) => {
        var _a;
        let res = true;
        if (queryInfo.active != null)
          res = res && activeTabId === tab.id;
        if (queryInfo.attention != null)
          res = res && tab.attention === queryInfo.attention;
        if (queryInfo.audible != null)
          res = res && tab.audible === queryInfo.audible;
        if (queryInfo.autoDiscardable != null)
          res = res && tab.autoDiscardable === queryInfo.autoDiscardable;
        if (queryInfo.camera != null)
          res = false;
        if (queryInfo.cookieStoreId != null)
          res = res && tab.cookieStoreId === queryInfo.cookieStoreId;
        if (queryInfo.currentWindow != null && queryInfo.currentWindow)
          res = res && currentWindow.id === tab.windowId;
        if (queryInfo.currentWindow != null && !queryInfo.currentWindow)
          res = res && currentWindow.id !== tab.windowId;
        if (queryInfo.discarded != null)
          res = res && tab.discarded === queryInfo.discarded;
        if (queryInfo.hidden != null)
          res = res && tab.hidden === queryInfo.hidden;
        if (queryInfo.highlighted != null)
          res = res && tab.highlighted === queryInfo.highlighted;
        if (queryInfo.index != null)
          res = res && tab.index === queryInfo.index;
        if (queryInfo.lastFocusedWindow != null && queryInfo.lastFocusedWindow)
          res = res && lastFocusedWindow.id === tab.windowId;
        if (queryInfo.lastFocusedWindow != null && !queryInfo.lastFocusedWindow)
          res = res && lastFocusedWindow.id !== tab.windowId;
        if (queryInfo.microphone != null)
          res = false;
        if (queryInfo.muted != null)
          res = res && ((_a = tab.mutedInfo) == null ? void 0 : _a.muted) === queryInfo.muted;
        if (queryInfo.openerTabId != null)
          res = res && !!tab.openerTabId;
        if (queryInfo.pinned != null)
          res = res && tab.pinned === queryInfo.pinned;
        if (queryInfo.screen != null)
          res = false;
        if (queryInfo.status != null)
          res = res && tab.status === queryInfo.status;
        if (queryInfo.title != null)
          res = res && tab.title == queryInfo.title;
        if (queryInfo.url != null)
          res = res && tab.url === queryInfo.url;
        if (queryInfo.windowType != null)
          res = false;
        return res;
      }).map(mapTab);
    });
  },
  highlight(highlightInfo) {
    return __async(this, null, function* () {
      const tabIds = Array.isArray(highlightInfo.tabs) ? highlightInfo.tabs : [highlightInfo.tabs];
      let window;
      for (const tabId of tabIds) {
        const tab = yield tabs.get(tabId);
        if (tab) {
          window = yield windows.get(tab.windowId);
          tab.highlighted = true;
        }
      }
      yield onHighlighted.trigger({ tabIds, windowId: window.id });
      return window;
    });
  },
  // @ts-expect-error the type expects an overload
  update(tabIdOrUpdateInfo, optionalUpdateInfo) {
    return __async(this, null, function* () {
      let updateInfo;
      if (tabIdOrUpdateInfo !== void 0 && typeof tabIdOrUpdateInfo === "object") {
        updateInfo = tabIdOrUpdateInfo;
      } else {
        updateInfo = optionalUpdateInfo;
      }
      let tabId;
      if (typeof tabIdOrUpdateInfo === "number") {
        tabId = tabIdOrUpdateInfo;
      } else {
        const currentWindow = yield windows.getCurrent();
        tabId = currentWindow.tabs.find((tab2) => tab2.active).id;
      }
      const tab = yield tabs.get(tabId);
      if (!tab)
        throw new Error("Tab not found");
      const updatedTab = __spreadValues(__spreadValues({}, tab), updateInfo);
      const tabIndex = tabList.findIndex((tab2) => tab2.id === tabId);
      tabList[tabIndex] = updatedTab;
      const fullTab = mapTab(updatedTab);
      yield onUpdated.trigger(fullTab.id, updateInfo, fullTab);
      return fullTab;
    });
  },
  remove(tabIds) {
    return __async(this, null, function* () {
      var _a;
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      for (const id of ids) {
        const index = tabList.findIndex((tab) => tab.id === id);
        if (index >= 0) {
          const [removed] = tabList.splice(index, 1);
          const window = yield windows.get(removed.id, { populate: true });
          yield onRemoved2.trigger(id, { isWindowClosing: false, windowId: window.id });
          if (!((_a = window.tabs) == null ? void 0 : _a.length))
            yield windows.remove(window.id);
        }
      }
    });
  },
  onCreated: onCreated2,
  onUpdated,
  onActivated,
  onHighlighted,
  onRemoved: onRemoved2
};

// src/apis/webNavigation.ts
var webNavigation = {
  onBeforeNavigate: defineEventWithTrigger(),
  onCommitted: defineEventWithTrigger(),
  onCompleted: defineEventWithTrigger(),
  onCreatedNavigationTarget: defineEventWithTrigger(),
  onDOMContentLoaded: defineEventWithTrigger(),
  onErrorOccurred: defineEventWithTrigger(),
  onHistoryStateUpdated: defineEventWithTrigger(),
  onReferenceFragmentUpdated: defineEventWithTrigger(),
  onTabReplaced: defineEventWithTrigger()
};

// src/base.gen.ts
var GeneratedBrowser = {
  activityLog: {
    onExtensionActivity: {
      addListener: () => {
        throw Error(`Browser.activityLog.onExtensionActivity.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.activityLog.onExtensionActivity.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.activityLog.onExtensionActivity.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.activityLog.onExtensionActivity.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  alarms: {
    create: () => {
      throw Error(`Browser.alarms.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    get: () => {
      throw Error(`Browser.alarms.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAll: () => {
      throw Error(`Browser.alarms.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    clear: () => {
      throw Error(`Browser.alarms.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    clearAll: () => {
      throw Error(`Browser.alarms.clearAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onAlarm: {
      addListener: () => {
        throw Error(`Browser.alarms.onAlarm.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.alarms.onAlarm.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.alarms.onAlarm.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.alarms.onAlarm.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  bookmarks: {
    get: () => {
      throw Error(`Browser.bookmarks.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getChildren: () => {
      throw Error(`Browser.bookmarks.getChildren not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getRecent: () => {
      throw Error(`Browser.bookmarks.getRecent not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTree: () => {
      throw Error(`Browser.bookmarks.getTree not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getSubTree: () => {
      throw Error(`Browser.bookmarks.getSubTree not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    search: () => {
      throw Error(`Browser.bookmarks.search not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    create: () => {
      throw Error(`Browser.bookmarks.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    move: () => {
      throw Error(`Browser.bookmarks.move not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.bookmarks.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.bookmarks.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeTree: () => {
      throw Error(`Browser.bookmarks.removeTree not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onCreated: {
      addListener: () => {
        throw Error(`Browser.bookmarks.onCreated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.bookmarks.onCreated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.bookmarks.onCreated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.bookmarks.onCreated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onRemoved: {
      addListener: () => {
        throw Error(`Browser.bookmarks.onRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.bookmarks.onRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.bookmarks.onRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.bookmarks.onRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onChanged: {
      addListener: () => {
        throw Error(`Browser.bookmarks.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.bookmarks.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.bookmarks.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.bookmarks.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onMoved: {
      addListener: () => {
        throw Error(`Browser.bookmarks.onMoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.bookmarks.onMoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.bookmarks.onMoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.bookmarks.onMoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  action: {
    setTitle: () => {
      throw Error(`Browser.action.setTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTitle: () => {
      throw Error(`Browser.action.getTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getUserSettings: () => {
      throw Error(`Browser.action.getUserSettings not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setIcon: () => {
      throw Error(`Browser.action.setIcon not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setPopup: () => {
      throw Error(`Browser.action.setPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getPopup: () => {
      throw Error(`Browser.action.getPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeText: () => {
      throw Error(`Browser.action.setBadgeText not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeText: () => {
      throw Error(`Browser.action.getBadgeText not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeBackgroundColor: () => {
      throw Error(`Browser.action.setBadgeBackgroundColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeBackgroundColor: () => {
      throw Error(`Browser.action.getBadgeBackgroundColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeTextColor: () => {
      throw Error(`Browser.action.setBadgeTextColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeTextColor: () => {
      throw Error(`Browser.action.getBadgeTextColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    enable: () => {
      throw Error(`Browser.action.enable not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    disable: () => {
      throw Error(`Browser.action.disable not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isEnabled: () => {
      throw Error(`Browser.action.isEnabled not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    openPopup: () => {
      throw Error(`Browser.action.openPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.action.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.action.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.action.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.action.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  browserAction: {
    setTitle: () => {
      throw Error(`Browser.browserAction.setTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTitle: () => {
      throw Error(`Browser.browserAction.getTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getUserSettings: () => {
      throw Error(`Browser.browserAction.getUserSettings not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setIcon: () => {
      throw Error(`Browser.browserAction.setIcon not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setPopup: () => {
      throw Error(`Browser.browserAction.setPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getPopup: () => {
      throw Error(`Browser.browserAction.getPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeText: () => {
      throw Error(`Browser.browserAction.setBadgeText not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeText: () => {
      throw Error(`Browser.browserAction.getBadgeText not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeBackgroundColor: () => {
      throw Error(`Browser.browserAction.setBadgeBackgroundColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeBackgroundColor: () => {
      throw Error(`Browser.browserAction.getBadgeBackgroundColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setBadgeTextColor: () => {
      throw Error(`Browser.browserAction.setBadgeTextColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBadgeTextColor: () => {
      throw Error(`Browser.browserAction.getBadgeTextColor not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    enable: () => {
      throw Error(`Browser.browserAction.enable not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    disable: () => {
      throw Error(`Browser.browserAction.disable not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isEnabled: () => {
      throw Error(`Browser.browserAction.isEnabled not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    openPopup: () => {
      throw Error(`Browser.browserAction.openPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.browserAction.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.browserAction.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.browserAction.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.browserAction.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  browserSettings: {
    allowPopupsForUserEvents: {
      get: () => {
        throw Error(`Browser.browserSettings.allowPopupsForUserEvents.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.allowPopupsForUserEvents.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.allowPopupsForUserEvents.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.allowPopupsForUserEvents.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.allowPopupsForUserEvents.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.allowPopupsForUserEvents.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.allowPopupsForUserEvents.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    cacheEnabled: {
      get: () => {
        throw Error(`Browser.browserSettings.cacheEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.cacheEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.cacheEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.cacheEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.cacheEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.cacheEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.cacheEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    closeTabsByDoubleClick: {
      get: () => {
        throw Error(`Browser.browserSettings.closeTabsByDoubleClick.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.closeTabsByDoubleClick.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.closeTabsByDoubleClick.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.closeTabsByDoubleClick.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.closeTabsByDoubleClick.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.closeTabsByDoubleClick.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.closeTabsByDoubleClick.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    contextMenuShowEvent: {
      get: () => {
        throw Error(`Browser.browserSettings.contextMenuShowEvent.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.contextMenuShowEvent.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.contextMenuShowEvent.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.contextMenuShowEvent.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.contextMenuShowEvent.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.contextMenuShowEvent.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.contextMenuShowEvent.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    homepageOverride: {
      get: () => {
        throw Error(`Browser.browserSettings.homepageOverride.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.homepageOverride.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.homepageOverride.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.homepageOverride.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.homepageOverride.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.homepageOverride.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.homepageOverride.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    imageAnimationBehavior: {
      get: () => {
        throw Error(`Browser.browserSettings.imageAnimationBehavior.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.imageAnimationBehavior.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.imageAnimationBehavior.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.imageAnimationBehavior.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.imageAnimationBehavior.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.imageAnimationBehavior.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.imageAnimationBehavior.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    newTabPageOverride: {
      get: () => {
        throw Error(`Browser.browserSettings.newTabPageOverride.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.newTabPageOverride.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.newTabPageOverride.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.newTabPageOverride.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.newTabPageOverride.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.newTabPageOverride.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.newTabPageOverride.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    newTabPosition: {
      get: () => {
        throw Error(`Browser.browserSettings.newTabPosition.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.newTabPosition.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.newTabPosition.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.newTabPosition.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.newTabPosition.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.newTabPosition.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.newTabPosition.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    openBookmarksInNewTabs: {
      get: () => {
        throw Error(`Browser.browserSettings.openBookmarksInNewTabs.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.openBookmarksInNewTabs.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.openBookmarksInNewTabs.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.openBookmarksInNewTabs.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.openBookmarksInNewTabs.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.openBookmarksInNewTabs.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.openBookmarksInNewTabs.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    openSearchResultsInNewTabs: {
      get: () => {
        throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.openSearchResultsInNewTabs.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    openUrlbarResultsInNewTabs: {
      get: () => {
        throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.openUrlbarResultsInNewTabs.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    webNotificationsDisabled: {
      get: () => {
        throw Error(`Browser.browserSettings.webNotificationsDisabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.webNotificationsDisabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.webNotificationsDisabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.webNotificationsDisabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.webNotificationsDisabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.webNotificationsDisabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.webNotificationsDisabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    overrideDocumentColors: {
      get: () => {
        throw Error(`Browser.browserSettings.overrideDocumentColors.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.overrideDocumentColors.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.overrideDocumentColors.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.overrideDocumentColors.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.overrideDocumentColors.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.overrideDocumentColors.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.overrideDocumentColors.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    overrideContentColorScheme: {
      get: () => {
        throw Error(`Browser.browserSettings.overrideContentColorScheme.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.overrideContentColorScheme.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.overrideContentColorScheme.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.overrideContentColorScheme.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.overrideContentColorScheme.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.overrideContentColorScheme.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.overrideContentColorScheme.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    useDocumentFonts: {
      get: () => {
        throw Error(`Browser.browserSettings.useDocumentFonts.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.useDocumentFonts.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.useDocumentFonts.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.useDocumentFonts.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.useDocumentFonts.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.useDocumentFonts.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.useDocumentFonts.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    zoomFullPage: {
      get: () => {
        throw Error(`Browser.browserSettings.zoomFullPage.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.zoomFullPage.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.zoomFullPage.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.zoomFullPage.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.zoomFullPage.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.zoomFullPage.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.zoomFullPage.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    zoomSiteSpecific: {
      get: () => {
        throw Error(`Browser.browserSettings.zoomSiteSpecific.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.browserSettings.zoomSiteSpecific.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.browserSettings.zoomSiteSpecific.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.browserSettings.zoomSiteSpecific.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.browserSettings.zoomSiteSpecific.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.browserSettings.zoomSiteSpecific.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.browserSettings.zoomSiteSpecific.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    colorManagement: {
      mode: {
        get: () => {
          throw Error(`Browser.browserSettings.colorManagement.mode.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.browserSettings.colorManagement.mode.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.browserSettings.colorManagement.mode.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.mode.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.mode.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.mode.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.browserSettings.colorManagement.mode.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      useNativeSRGB: {
        get: () => {
          throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.browserSettings.colorManagement.useNativeSRGB.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      useWebRenderCompositor: {
        get: () => {
          throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.browserSettings.colorManagement.useWebRenderCompositor.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      }
    }
  },
  browsingData: {
    settings: () => {
      throw Error(`Browser.browsingData.settings not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.browsingData.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeCache: () => {
      throw Error(`Browser.browsingData.removeCache not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeCookies: () => {
      throw Error(`Browser.browsingData.removeCookies not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeDownloads: () => {
      throw Error(`Browser.browsingData.removeDownloads not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeFormData: () => {
      throw Error(`Browser.browsingData.removeFormData not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeHistory: () => {
      throw Error(`Browser.browsingData.removeHistory not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeLocalStorage: () => {
      throw Error(`Browser.browsingData.removeLocalStorage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removePluginData: () => {
      throw Error(`Browser.browsingData.removePluginData not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removePasswords: () => {
      throw Error(`Browser.browsingData.removePasswords not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  captivePortal: {
    getState: () => {
      throw Error(`Browser.captivePortal.getState not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getLastChecked: () => {
      throw Error(`Browser.captivePortal.getLastChecked not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onStateChanged: {
      addListener: () => {
        throw Error(`Browser.captivePortal.onStateChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.captivePortal.onStateChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.captivePortal.onStateChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.captivePortal.onStateChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onConnectivityAvailable: {
      addListener: () => {
        throw Error(`Browser.captivePortal.onConnectivityAvailable.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.captivePortal.onConnectivityAvailable.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.captivePortal.onConnectivityAvailable.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.captivePortal.onConnectivityAvailable.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    canonicalURL: {
      get: () => {
        throw Error(`Browser.captivePortal.canonicalURL.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.captivePortal.canonicalURL.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.captivePortal.canonicalURL.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.captivePortal.canonicalURL.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.captivePortal.canonicalURL.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.captivePortal.canonicalURL.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.captivePortal.canonicalURL.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    }
  },
  clipboard: {
    setImageData: () => {
      throw Error(`Browser.clipboard.setImageData not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  commands: {
    update: () => {
      throw Error(`Browser.commands.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    reset: () => {
      throw Error(`Browser.commands.reset not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAll: () => {
      throw Error(`Browser.commands.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onCommand: {
      addListener: () => {
        throw Error(`Browser.commands.onCommand.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.commands.onCommand.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.commands.onCommand.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.commands.onCommand.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onChanged: {
      addListener: () => {
        throw Error(`Browser.commands.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.commands.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.commands.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.commands.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  contentScripts: {
    register: () => {
      throw Error(`Browser.contentScripts.register not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  contextualIdentities: {
    get: () => {
      throw Error(`Browser.contextualIdentities.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    query: () => {
      throw Error(`Browser.contextualIdentities.query not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    create: () => {
      throw Error(`Browser.contextualIdentities.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.contextualIdentities.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.contextualIdentities.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onUpdated: {
      addListener: () => {
        throw Error(`Browser.contextualIdentities.onUpdated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextualIdentities.onUpdated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextualIdentities.onUpdated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextualIdentities.onUpdated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onCreated: {
      addListener: () => {
        throw Error(`Browser.contextualIdentities.onCreated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextualIdentities.onCreated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextualIdentities.onCreated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextualIdentities.onCreated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onRemoved: {
      addListener: () => {
        throw Error(`Browser.contextualIdentities.onRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextualIdentities.onRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextualIdentities.onRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextualIdentities.onRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  cookies: {
    get: () => {
      throw Error(`Browser.cookies.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAll: () => {
      throw Error(`Browser.cookies.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    set: () => {
      throw Error(`Browser.cookies.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.cookies.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAllCookieStores: () => {
      throw Error(`Browser.cookies.getAllCookieStores not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onChanged: {
      addListener: () => {
        throw Error(`Browser.cookies.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.cookies.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.cookies.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.cookies.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  declarativeNetRequest: {
    updateDynamicRules: () => {
      throw Error(`Browser.declarativeNetRequest.updateDynamicRules not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    updateSessionRules: () => {
      throw Error(`Browser.declarativeNetRequest.updateSessionRules not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getEnabledRulesets: () => {
      throw Error(`Browser.declarativeNetRequest.getEnabledRulesets not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    updateEnabledRulesets: () => {
      throw Error(`Browser.declarativeNetRequest.updateEnabledRulesets not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAvailableStaticRuleCount: () => {
      throw Error(`Browser.declarativeNetRequest.getAvailableStaticRuleCount not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getDynamicRules: () => {
      throw Error(`Browser.declarativeNetRequest.getDynamicRules not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getSessionRules: () => {
      throw Error(`Browser.declarativeNetRequest.getSessionRules not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isRegexSupported: () => {
      throw Error(`Browser.declarativeNetRequest.isRegexSupported not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    testMatchOutcome: () => {
      throw Error(`Browser.declarativeNetRequest.testMatchOutcome not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    DYNAMIC_RULESET_ID: "_dynamic",
    GUARANTEED_MINIMUM_STATIC_RULES: 0,
    MAX_NUMBER_OF_STATIC_RULESETS: 0,
    MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: 0,
    MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 0,
    MAX_NUMBER_OF_REGEX_RULES: 0,
    SESSION_RULESET_ID: "_session"
  },
  devtools: {
    inspectedWindow: {
      eval: () => {
        throw Error(`Browser.devtools.inspectedWindow.eval not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      reload: () => {
        throw Error(`Browser.devtools.inspectedWindow.reload not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      tabId: 0
    },
    network: {
      getHAR: () => {
        throw Error(`Browser.devtools.network.getHAR not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onRequestFinished: {
        addListener: () => {
          throw Error(`Browser.devtools.network.onRequestFinished.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.devtools.network.onRequestFinished.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.devtools.network.onRequestFinished.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.devtools.network.onRequestFinished.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      },
      onNavigated: {
        addListener: () => {
          throw Error(`Browser.devtools.network.onNavigated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.devtools.network.onNavigated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.devtools.network.onNavigated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.devtools.network.onNavigated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    panels: {
      create: () => {
        throw Error(`Browser.devtools.panels.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onThemeChanged: {
        addListener: () => {
          throw Error(`Browser.devtools.panels.onThemeChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.devtools.panels.onThemeChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.devtools.panels.onThemeChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.devtools.panels.onThemeChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      },
      elements: {
        createSidebarPane: () => {
          throw Error(`Browser.devtools.panels.elements.createSidebarPane not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onSelectionChanged: {
          addListener: () => {
            throw Error(`Browser.devtools.panels.elements.onSelectionChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.devtools.panels.elements.onSelectionChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.devtools.panels.elements.onSelectionChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.devtools.panels.elements.onSelectionChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      sources: {},
      themeName: ""
    }
  },
  dns: {
    resolve: () => {
      throw Error(`Browser.dns.resolve not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  downloads: {
    download: () => {
      throw Error(`Browser.downloads.download not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    search: () => {
      throw Error(`Browser.downloads.search not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    pause: () => {
      throw Error(`Browser.downloads.pause not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    resume: () => {
      throw Error(`Browser.downloads.resume not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    cancel: () => {
      throw Error(`Browser.downloads.cancel not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getFileIcon: () => {
      throw Error(`Browser.downloads.getFileIcon not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    open: () => {
      throw Error(`Browser.downloads.open not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    show: () => {
      throw Error(`Browser.downloads.show not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    showDefaultFolder: () => {
      throw Error(`Browser.downloads.showDefaultFolder not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    erase: () => {
      throw Error(`Browser.downloads.erase not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeFile: () => {
      throw Error(`Browser.downloads.removeFile not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onCreated: {
      addListener: () => {
        throw Error(`Browser.downloads.onCreated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.downloads.onCreated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.downloads.onCreated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.downloads.onCreated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onErased: {
      addListener: () => {
        throw Error(`Browser.downloads.onErased.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.downloads.onErased.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.downloads.onErased.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.downloads.onErased.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onChanged: {
      addListener: () => {
        throw Error(`Browser.downloads.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.downloads.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.downloads.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.downloads.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  events: {},
  experiments: {},
  extension: {
    getViews: () => {
      throw Error(`Browser.extension.getViews not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBackgroundPage: () => {
      throw Error(`Browser.extension.getBackgroundPage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isAllowedIncognitoAccess: () => {
      throw Error(`Browser.extension.isAllowedIncognitoAccess not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isAllowedFileSchemeAccess: () => {
      throw Error(`Browser.extension.isAllowedFileSchemeAccess not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    inIncognitoContext: false
  },
  extensionTypes: {},
  find: {
    find: () => {
      throw Error(`Browser.find.find not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    highlightResults: () => {
      throw Error(`Browser.find.highlightResults not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeHighlighting: () => {
      throw Error(`Browser.find.removeHighlighting not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  geckoProfiler: {
    start: () => {
      throw Error(`Browser.geckoProfiler.start not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    stop: () => {
      throw Error(`Browser.geckoProfiler.stop not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    pause: () => {
      throw Error(`Browser.geckoProfiler.pause not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    resume: () => {
      throw Error(`Browser.geckoProfiler.resume not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    dumpProfileToFile: () => {
      throw Error(`Browser.geckoProfiler.dumpProfileToFile not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getProfile: () => {
      throw Error(`Browser.geckoProfiler.getProfile not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getProfileAsArrayBuffer: () => {
      throw Error(`Browser.geckoProfiler.getProfileAsArrayBuffer not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getProfileAsGzippedArrayBuffer: () => {
      throw Error(`Browser.geckoProfiler.getProfileAsGzippedArrayBuffer not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getSymbols: () => {
      throw Error(`Browser.geckoProfiler.getSymbols not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onRunning: {
      addListener: () => {
        throw Error(`Browser.geckoProfiler.onRunning.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.geckoProfiler.onRunning.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.geckoProfiler.onRunning.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.geckoProfiler.onRunning.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  history: {
    search: () => {
      throw Error(`Browser.history.search not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getVisits: () => {
      throw Error(`Browser.history.getVisits not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    addUrl: () => {
      throw Error(`Browser.history.addUrl not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    deleteUrl: () => {
      throw Error(`Browser.history.deleteUrl not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    deleteRange: () => {
      throw Error(`Browser.history.deleteRange not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    deleteAll: () => {
      throw Error(`Browser.history.deleteAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onVisited: {
      addListener: () => {
        throw Error(`Browser.history.onVisited.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.history.onVisited.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.history.onVisited.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.history.onVisited.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onVisitRemoved: {
      addListener: () => {
        throw Error(`Browser.history.onVisitRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.history.onVisitRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.history.onVisitRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.history.onVisitRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onTitleChanged: {
      addListener: () => {
        throw Error(`Browser.history.onTitleChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.history.onTitleChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.history.onTitleChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.history.onTitleChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  i18n: {
    getAcceptLanguages: () => {
      throw Error(`Browser.i18n.getAcceptLanguages not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getMessage: () => {
      throw Error(`Browser.i18n.getMessage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getUILanguage: () => {
      throw Error(`Browser.i18n.getUILanguage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    detectLanguage: () => {
      throw Error(`Browser.i18n.detectLanguage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  identity: {
    launchWebAuthFlow: () => {
      throw Error(`Browser.identity.launchWebAuthFlow not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getRedirectURL: () => {
      throw Error(`Browser.identity.getRedirectURL not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  idle: {
    queryState: () => {
      throw Error(`Browser.idle.queryState not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setDetectionInterval: () => {
      throw Error(`Browser.idle.setDetectionInterval not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onStateChanged: {
      addListener: () => {
        throw Error(`Browser.idle.onStateChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.idle.onStateChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.idle.onStateChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.idle.onStateChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  management: {
    getAll: () => {
      throw Error(`Browser.management.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    get: () => {
      throw Error(`Browser.management.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    install: () => {
      throw Error(`Browser.management.install not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getSelf: () => {
      throw Error(`Browser.management.getSelf not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    uninstallSelf: () => {
      throw Error(`Browser.management.uninstallSelf not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setEnabled: () => {
      throw Error(`Browser.management.setEnabled not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onDisabled: {
      addListener: () => {
        throw Error(`Browser.management.onDisabled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.management.onDisabled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.management.onDisabled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.management.onDisabled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onEnabled: {
      addListener: () => {
        throw Error(`Browser.management.onEnabled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.management.onEnabled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.management.onEnabled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.management.onEnabled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onInstalled: {
      addListener: () => {
        throw Error(`Browser.management.onInstalled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.management.onInstalled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.management.onInstalled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.management.onInstalled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onUninstalled: {
      addListener: () => {
        throw Error(`Browser.management.onUninstalled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.management.onUninstalled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.management.onUninstalled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.management.onUninstalled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  manifest: {},
  contextMenus: {
    create: () => {
      throw Error(`Browser.contextMenus.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.contextMenus.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.contextMenus.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeAll: () => {
      throw Error(`Browser.contextMenus.removeAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    overrideContext: () => {
      throw Error(`Browser.contextMenus.overrideContext not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    refresh: () => {
      throw Error(`Browser.contextMenus.refresh not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTargetElement: () => {
      throw Error(`Browser.contextMenus.getTargetElement not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.contextMenus.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextMenus.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextMenus.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextMenus.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onShown: {
      addListener: () => {
        throw Error(`Browser.contextMenus.onShown.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextMenus.onShown.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextMenus.onShown.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextMenus.onShown.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onHidden: {
      addListener: () => {
        throw Error(`Browser.contextMenus.onHidden.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.contextMenus.onHidden.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.contextMenus.onHidden.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.contextMenus.onHidden.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    ACTION_MENU_TOP_LEVEL_LIMIT: 6
  },
  menus: {
    create: () => {
      throw Error(`Browser.menus.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.menus.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.menus.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeAll: () => {
      throw Error(`Browser.menus.removeAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    overrideContext: () => {
      throw Error(`Browser.menus.overrideContext not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    refresh: () => {
      throw Error(`Browser.menus.refresh not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTargetElement: () => {
      throw Error(`Browser.menus.getTargetElement not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.menus.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.menus.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.menus.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.menus.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onShown: {
      addListener: () => {
        throw Error(`Browser.menus.onShown.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.menus.onShown.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.menus.onShown.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.menus.onShown.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onHidden: {
      addListener: () => {
        throw Error(`Browser.menus.onHidden.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.menus.onHidden.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.menus.onHidden.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.menus.onHidden.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    ACTION_MENU_TOP_LEVEL_LIMIT: 6
  },
  networkStatus: {
    getLinkInfo: () => {
      throw Error(`Browser.networkStatus.getLinkInfo not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onConnectionChanged: {
      addListener: () => {
        throw Error(`Browser.networkStatus.onConnectionChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.networkStatus.onConnectionChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.networkStatus.onConnectionChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.networkStatus.onConnectionChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  normandyAddonStudy: {
    getStudy: () => {
      throw Error(`Browser.normandyAddonStudy.getStudy not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    endStudy: () => {
      throw Error(`Browser.normandyAddonStudy.endStudy not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getClientMetadata: () => {
      throw Error(`Browser.normandyAddonStudy.getClientMetadata not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onUnenroll: {
      addListener: () => {
        throw Error(`Browser.normandyAddonStudy.onUnenroll.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.normandyAddonStudy.onUnenroll.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.normandyAddonStudy.onUnenroll.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.normandyAddonStudy.onUnenroll.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  notifications: {
    create: () => {
      throw Error(`Browser.notifications.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    clear: () => {
      throw Error(`Browser.notifications.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAll: () => {
      throw Error(`Browser.notifications.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClosed: {
      addListener: () => {
        throw Error(`Browser.notifications.onClosed.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.notifications.onClosed.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.notifications.onClosed.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.notifications.onClosed.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.notifications.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.notifications.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.notifications.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.notifications.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onButtonClicked: {
      addListener: () => {
        throw Error(`Browser.notifications.onButtonClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.notifications.onButtonClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.notifications.onButtonClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.notifications.onButtonClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onShown: {
      addListener: () => {
        throw Error(`Browser.notifications.onShown.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.notifications.onShown.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.notifications.onShown.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.notifications.onShown.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  omnibox: {
    setDefaultSuggestion: () => {
      throw Error(`Browser.omnibox.setDefaultSuggestion not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onInputStarted: {
      addListener: () => {
        throw Error(`Browser.omnibox.onInputStarted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.omnibox.onInputStarted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.omnibox.onInputStarted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.omnibox.onInputStarted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onInputChanged: {
      addListener: () => {
        throw Error(`Browser.omnibox.onInputChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.omnibox.onInputChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.omnibox.onInputChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.omnibox.onInputChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onInputEntered: {
      addListener: () => {
        throw Error(`Browser.omnibox.onInputEntered.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.omnibox.onInputEntered.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.omnibox.onInputEntered.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.omnibox.onInputEntered.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onInputCancelled: {
      addListener: () => {
        throw Error(`Browser.omnibox.onInputCancelled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.omnibox.onInputCancelled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.omnibox.onInputCancelled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.omnibox.onInputCancelled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onDeleteSuggestion: {
      addListener: () => {
        throw Error(`Browser.omnibox.onDeleteSuggestion.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.omnibox.onDeleteSuggestion.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.omnibox.onDeleteSuggestion.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.omnibox.onDeleteSuggestion.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  pageAction: {
    show: () => {
      throw Error(`Browser.pageAction.show not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    hide: () => {
      throw Error(`Browser.pageAction.hide not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isShown: () => {
      throw Error(`Browser.pageAction.isShown not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setTitle: () => {
      throw Error(`Browser.pageAction.setTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTitle: () => {
      throw Error(`Browser.pageAction.getTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setIcon: () => {
      throw Error(`Browser.pageAction.setIcon not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setPopup: () => {
      throw Error(`Browser.pageAction.setPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getPopup: () => {
      throw Error(`Browser.pageAction.getPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    openPopup: () => {
      throw Error(`Browser.pageAction.openPopup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onClicked: {
      addListener: () => {
        throw Error(`Browser.pageAction.onClicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.pageAction.onClicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.pageAction.onClicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.pageAction.onClicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  permissions: {
    getAll: () => {
      throw Error(`Browser.permissions.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    contains: () => {
      throw Error(`Browser.permissions.contains not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    request: () => {
      throw Error(`Browser.permissions.request not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.permissions.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onAdded: {
      addListener: () => {
        throw Error(`Browser.permissions.onAdded.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.permissions.onAdded.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.permissions.onAdded.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.permissions.onAdded.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onRemoved: {
      addListener: () => {
        throw Error(`Browser.permissions.onRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.permissions.onRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.permissions.onRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.permissions.onRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  pkcs11: {
    isModuleInstalled: () => {
      throw Error(`Browser.pkcs11.isModuleInstalled not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    installModule: () => {
      throw Error(`Browser.pkcs11.installModule not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    uninstallModule: () => {
      throw Error(`Browser.pkcs11.uninstallModule not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getModuleSlots: () => {
      throw Error(`Browser.pkcs11.getModuleSlots not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  privacy: {
    network: {
      networkPredictionEnabled: {
        get: () => {
          throw Error(`Browser.privacy.network.networkPredictionEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.networkPredictionEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.networkPredictionEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.networkPredictionEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.networkPredictionEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.networkPredictionEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.networkPredictionEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      peerConnectionEnabled: {
        get: () => {
          throw Error(`Browser.privacy.network.peerConnectionEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.peerConnectionEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.peerConnectionEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.peerConnectionEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.peerConnectionEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.peerConnectionEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.peerConnectionEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      webRTCIPHandlingPolicy: {
        get: () => {
          throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.webRTCIPHandlingPolicy.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      tlsVersionRestriction: {
        get: () => {
          throw Error(`Browser.privacy.network.tlsVersionRestriction.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.tlsVersionRestriction.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.tlsVersionRestriction.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.tlsVersionRestriction.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.tlsVersionRestriction.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.tlsVersionRestriction.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.tlsVersionRestriction.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      httpsOnlyMode: {
        get: () => {
          throw Error(`Browser.privacy.network.httpsOnlyMode.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.httpsOnlyMode.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.httpsOnlyMode.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.httpsOnlyMode.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.httpsOnlyMode.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.httpsOnlyMode.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.httpsOnlyMode.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      globalPrivacyControl: {
        get: () => {
          throw Error(`Browser.privacy.network.globalPrivacyControl.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.network.globalPrivacyControl.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.network.globalPrivacyControl.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.network.globalPrivacyControl.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.network.globalPrivacyControl.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.network.globalPrivacyControl.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.network.globalPrivacyControl.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      }
    },
    services: {
      passwordSavingEnabled: {
        get: () => {
          throw Error(`Browser.privacy.services.passwordSavingEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.services.passwordSavingEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.services.passwordSavingEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.services.passwordSavingEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.services.passwordSavingEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.services.passwordSavingEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.services.passwordSavingEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      }
    },
    websites: {
      hyperlinkAuditingEnabled: {
        get: () => {
          throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.hyperlinkAuditingEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      referrersEnabled: {
        get: () => {
          throw Error(`Browser.privacy.websites.referrersEnabled.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.referrersEnabled.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.referrersEnabled.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.referrersEnabled.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.referrersEnabled.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.referrersEnabled.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.referrersEnabled.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      resistFingerprinting: {
        get: () => {
          throw Error(`Browser.privacy.websites.resistFingerprinting.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.resistFingerprinting.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.resistFingerprinting.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.resistFingerprinting.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.resistFingerprinting.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.resistFingerprinting.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.resistFingerprinting.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      firstPartyIsolate: {
        get: () => {
          throw Error(`Browser.privacy.websites.firstPartyIsolate.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.firstPartyIsolate.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.firstPartyIsolate.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.firstPartyIsolate.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.firstPartyIsolate.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.firstPartyIsolate.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.firstPartyIsolate.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      trackingProtectionMode: {
        get: () => {
          throw Error(`Browser.privacy.websites.trackingProtectionMode.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.trackingProtectionMode.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.trackingProtectionMode.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.trackingProtectionMode.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.trackingProtectionMode.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.trackingProtectionMode.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.trackingProtectionMode.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      },
      cookieConfig: {
        get: () => {
          throw Error(`Browser.privacy.websites.cookieConfig.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        set: () => {
          throw Error(`Browser.privacy.websites.cookieConfig.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        clear: () => {
          throw Error(`Browser.privacy.websites.cookieConfig.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        onChange: {
          addListener: () => {
            throw Error(`Browser.privacy.websites.cookieConfig.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          removeListener: () => {
            throw Error(`Browser.privacy.websites.cookieConfig.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListener: () => {
            throw Error(`Browser.privacy.websites.cookieConfig.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          },
          hasListeners: () => {
            throw Error(`Browser.privacy.websites.cookieConfig.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
          }
        }
      }
    }
  },
  proxy: {
    onRequest: {
      addListener: () => {
        throw Error(`Browser.proxy.onRequest.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.proxy.onRequest.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.proxy.onRequest.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.proxy.onRequest.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onError: {
      addListener: () => {
        throw Error(`Browser.proxy.onError.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.proxy.onError.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.proxy.onError.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.proxy.onError.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    settings: {
      get: () => {
        throw Error(`Browser.proxy.settings.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.proxy.settings.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.proxy.settings.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.proxy.settings.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.proxy.settings.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.proxy.settings.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.proxy.settings.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    }
  },
  runtime: {
    getBackgroundPage: () => {
      throw Error(`Browser.runtime.getBackgroundPage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    openOptionsPage: () => {
      throw Error(`Browser.runtime.openOptionsPage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getManifest: () => {
      throw Error(`Browser.runtime.getManifest not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getURL: () => {
      throw Error(`Browser.runtime.getURL not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getFrameId: () => {
      throw Error(`Browser.runtime.getFrameId not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setUninstallURL: () => {
      throw Error(`Browser.runtime.setUninstallURL not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    reload: () => {
      throw Error(`Browser.runtime.reload not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    requestUpdateCheck: () => {
      throw Error(`Browser.runtime.requestUpdateCheck not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    connect: () => {
      throw Error(`Browser.runtime.connect not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    connectNative: () => {
      throw Error(`Browser.runtime.connectNative not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    sendMessage: () => {
      throw Error(`Browser.runtime.sendMessage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    sendNativeMessage: () => {
      throw Error(`Browser.runtime.sendNativeMessage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getBrowserInfo: () => {
      throw Error(`Browser.runtime.getBrowserInfo not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getPlatformInfo: () => {
      throw Error(`Browser.runtime.getPlatformInfo not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onStartup: {
      addListener: () => {
        throw Error(`Browser.runtime.onStartup.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onStartup.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onStartup.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onStartup.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onInstalled: {
      addListener: () => {
        throw Error(`Browser.runtime.onInstalled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onInstalled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onInstalled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onInstalled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onSuspend: {
      addListener: () => {
        throw Error(`Browser.runtime.onSuspend.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onSuspend.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onSuspend.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onSuspend.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onSuspendCanceled: {
      addListener: () => {
        throw Error(`Browser.runtime.onSuspendCanceled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onSuspendCanceled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onSuspendCanceled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onSuspendCanceled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onUpdateAvailable: {
      addListener: () => {
        throw Error(`Browser.runtime.onUpdateAvailable.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onUpdateAvailable.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onUpdateAvailable.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onUpdateAvailable.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onConnect: {
      addListener: () => {
        throw Error(`Browser.runtime.onConnect.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onConnect.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onConnect.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onConnect.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onConnectExternal: {
      addListener: () => {
        throw Error(`Browser.runtime.onConnectExternal.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onConnectExternal.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onConnectExternal.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onConnectExternal.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onMessage: {
      addListener: () => {
        throw Error(`Browser.runtime.onMessage.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onMessage.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onMessage.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onMessage.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onMessageExternal: {
      addListener: () => {
        throw Error(`Browser.runtime.onMessageExternal.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.runtime.onMessageExternal.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.runtime.onMessageExternal.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.runtime.onMessageExternal.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    lastError: {
      message: ""
    },
    id: ""
  },
  scripting: {
    executeScript: () => {
      throw Error(`Browser.scripting.executeScript not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    insertCSS: () => {
      throw Error(`Browser.scripting.insertCSS not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeCSS: () => {
      throw Error(`Browser.scripting.removeCSS not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    registerContentScripts: () => {
      throw Error(`Browser.scripting.registerContentScripts not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getRegisteredContentScripts: () => {
      throw Error(`Browser.scripting.getRegisteredContentScripts not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    unregisterContentScripts: () => {
      throw Error(`Browser.scripting.unregisterContentScripts not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    updateContentScripts: () => {
      throw Error(`Browser.scripting.updateContentScripts not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  search: {
    get: () => {
      throw Error(`Browser.search.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    search: () => {
      throw Error(`Browser.search.search not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    query: () => {
      throw Error(`Browser.search.query not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  sessions: {
    forgetClosedTab: () => {
      throw Error(`Browser.sessions.forgetClosedTab not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    forgetClosedWindow: () => {
      throw Error(`Browser.sessions.forgetClosedWindow not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getRecentlyClosed: () => {
      throw Error(`Browser.sessions.getRecentlyClosed not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    restore: () => {
      throw Error(`Browser.sessions.restore not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setTabValue: () => {
      throw Error(`Browser.sessions.setTabValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTabValue: () => {
      throw Error(`Browser.sessions.getTabValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeTabValue: () => {
      throw Error(`Browser.sessions.removeTabValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setWindowValue: () => {
      throw Error(`Browser.sessions.setWindowValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getWindowValue: () => {
      throw Error(`Browser.sessions.getWindowValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeWindowValue: () => {
      throw Error(`Browser.sessions.removeWindowValue not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onChanged: {
      addListener: () => {
        throw Error(`Browser.sessions.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.sessions.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.sessions.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.sessions.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    MAX_SESSION_RESULTS: 25
  },
  sidebarAction: {
    setTitle: () => {
      throw Error(`Browser.sidebarAction.setTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getTitle: () => {
      throw Error(`Browser.sidebarAction.getTitle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setIcon: () => {
      throw Error(`Browser.sidebarAction.setIcon not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setPanel: () => {
      throw Error(`Browser.sidebarAction.setPanel not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getPanel: () => {
      throw Error(`Browser.sidebarAction.getPanel not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    open: () => {
      throw Error(`Browser.sidebarAction.open not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    close: () => {
      throw Error(`Browser.sidebarAction.close not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    toggle: () => {
      throw Error(`Browser.sidebarAction.toggle not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    isOpen: () => {
      throw Error(`Browser.sidebarAction.isOpen not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  storage: {
    onChanged: {
      addListener: () => {
        throw Error(`Browser.storage.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.storage.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.storage.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.storage.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    sync: {
      QUOTA_BYTES: 102400,
      QUOTA_BYTES_PER_ITEM: 8192,
      MAX_ITEMS: 512,
      MAX_WRITE_OPERATIONS_PER_HOUR: 1800,
      MAX_WRITE_OPERATIONS_PER_MINUTE: 120,
      get: () => {
        throw Error(`Browser.storage.sync.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      getBytesInUse: () => {
        throw Error(`Browser.storage.sync.getBytesInUse not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.storage.sync.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      remove: () => {
        throw Error(`Browser.storage.sync.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.storage.sync.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChanged: {
        addListener: () => {
          throw Error(`Browser.storage.sync.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.storage.sync.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.storage.sync.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.storage.sync.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    local: {
      QUOTA_BYTES: 5242880,
      get: () => {
        throw Error(`Browser.storage.local.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.storage.local.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      remove: () => {
        throw Error(`Browser.storage.local.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.storage.local.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChanged: {
        addListener: () => {
          throw Error(`Browser.storage.local.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.storage.local.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.storage.local.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.storage.local.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    managed: {
      QUOTA_BYTES: 5242880,
      get: () => {
        throw Error(`Browser.storage.managed.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.storage.managed.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      remove: () => {
        throw Error(`Browser.storage.managed.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.storage.managed.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChanged: {
        addListener: () => {
          throw Error(`Browser.storage.managed.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.storage.managed.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.storage.managed.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.storage.managed.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    },
    session: {
      get: () => {
        throw Error(`Browser.storage.session.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.storage.session.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      remove: () => {
        throw Error(`Browser.storage.session.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.storage.session.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChanged: {
        addListener: () => {
          throw Error(`Browser.storage.session.onChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.storage.session.onChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.storage.session.onChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.storage.session.onChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    }
  },
  tabs: {
    get: () => {
      throw Error(`Browser.tabs.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getCurrent: () => {
      throw Error(`Browser.tabs.getCurrent not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    connect: () => {
      throw Error(`Browser.tabs.connect not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    sendMessage: () => {
      throw Error(`Browser.tabs.sendMessage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    create: () => {
      throw Error(`Browser.tabs.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    duplicate: () => {
      throw Error(`Browser.tabs.duplicate not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    query: () => {
      throw Error(`Browser.tabs.query not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    highlight: () => {
      throw Error(`Browser.tabs.highlight not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.tabs.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    move: () => {
      throw Error(`Browser.tabs.move not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    reload: () => {
      throw Error(`Browser.tabs.reload not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    warmup: () => {
      throw Error(`Browser.tabs.warmup not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.tabs.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    discard: () => {
      throw Error(`Browser.tabs.discard not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    detectLanguage: () => {
      throw Error(`Browser.tabs.detectLanguage not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    toggleReaderMode: () => {
      throw Error(`Browser.tabs.toggleReaderMode not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    captureTab: () => {
      throw Error(`Browser.tabs.captureTab not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    captureVisibleTab: () => {
      throw Error(`Browser.tabs.captureVisibleTab not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    executeScript: () => {
      throw Error(`Browser.tabs.executeScript not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    insertCSS: () => {
      throw Error(`Browser.tabs.insertCSS not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    removeCSS: () => {
      throw Error(`Browser.tabs.removeCSS not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setZoom: () => {
      throw Error(`Browser.tabs.setZoom not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getZoom: () => {
      throw Error(`Browser.tabs.getZoom not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    setZoomSettings: () => {
      throw Error(`Browser.tabs.setZoomSettings not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getZoomSettings: () => {
      throw Error(`Browser.tabs.getZoomSettings not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    print: () => {
      throw Error(`Browser.tabs.print not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    printPreview: () => {
      throw Error(`Browser.tabs.printPreview not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    saveAsPDF: () => {
      throw Error(`Browser.tabs.saveAsPDF not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    show: () => {
      throw Error(`Browser.tabs.show not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    hide: () => {
      throw Error(`Browser.tabs.hide not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    moveInSuccession: () => {
      throw Error(`Browser.tabs.moveInSuccession not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    goForward: () => {
      throw Error(`Browser.tabs.goForward not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    goBack: () => {
      throw Error(`Browser.tabs.goBack not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onCreated: {
      addListener: () => {
        throw Error(`Browser.tabs.onCreated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onCreated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onCreated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onCreated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onUpdated: {
      addListener: () => {
        throw Error(`Browser.tabs.onUpdated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onUpdated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onUpdated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onUpdated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onMoved: {
      addListener: () => {
        throw Error(`Browser.tabs.onMoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onMoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onMoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onMoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onActivated: {
      addListener: () => {
        throw Error(`Browser.tabs.onActivated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onActivated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onActivated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onActivated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onHighlighted: {
      addListener: () => {
        throw Error(`Browser.tabs.onHighlighted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onHighlighted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onHighlighted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onHighlighted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onDetached: {
      addListener: () => {
        throw Error(`Browser.tabs.onDetached.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onDetached.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onDetached.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onDetached.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onAttached: {
      addListener: () => {
        throw Error(`Browser.tabs.onAttached.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onAttached.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onAttached.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onAttached.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onRemoved: {
      addListener: () => {
        throw Error(`Browser.tabs.onRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onReplaced: {
      addListener: () => {
        throw Error(`Browser.tabs.onReplaced.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onReplaced.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onReplaced.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onReplaced.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onZoomChange: {
      addListener: () => {
        throw Error(`Browser.tabs.onZoomChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.tabs.onZoomChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.tabs.onZoomChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.tabs.onZoomChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    TAB_ID_NONE: -1
  },
  theme: {
    getCurrent: () => {
      throw Error(`Browser.theme.getCurrent not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.theme.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    reset: () => {
      throw Error(`Browser.theme.reset not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onUpdated: {
      addListener: () => {
        throw Error(`Browser.theme.onUpdated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.theme.onUpdated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.theme.onUpdated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.theme.onUpdated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  topSites: {
    get: () => {
      throw Error(`Browser.topSites.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  types: {},
  urlbar: {
    closeView: () => {
      throw Error(`Browser.urlbar.closeView not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    focus: () => {
      throw Error(`Browser.urlbar.focus not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    search: () => {
      throw Error(`Browser.urlbar.search not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onBehaviorRequested: {
      addListener: () => {
        throw Error(`Browser.urlbar.onBehaviorRequested.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.urlbar.onBehaviorRequested.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.urlbar.onBehaviorRequested.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.urlbar.onBehaviorRequested.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onEngagement: {
      addListener: () => {
        throw Error(`Browser.urlbar.onEngagement.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.urlbar.onEngagement.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.urlbar.onEngagement.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.urlbar.onEngagement.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onQueryCanceled: {
      addListener: () => {
        throw Error(`Browser.urlbar.onQueryCanceled.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.urlbar.onQueryCanceled.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.urlbar.onQueryCanceled.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.urlbar.onQueryCanceled.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onResultsRequested: {
      addListener: () => {
        throw Error(`Browser.urlbar.onResultsRequested.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.urlbar.onResultsRequested.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.urlbar.onResultsRequested.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.urlbar.onResultsRequested.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onResultPicked: {
      addListener: () => {
        throw Error(`Browser.urlbar.onResultPicked.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.urlbar.onResultPicked.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.urlbar.onResultPicked.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.urlbar.onResultPicked.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    engagementTelemetry: {
      get: () => {
        throw Error(`Browser.urlbar.engagementTelemetry.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      set: () => {
        throw Error(`Browser.urlbar.engagementTelemetry.set not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      clear: () => {
        throw Error(`Browser.urlbar.engagementTelemetry.clear not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      onChange: {
        addListener: () => {
          throw Error(`Browser.urlbar.engagementTelemetry.onChange.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        removeListener: () => {
          throw Error(`Browser.urlbar.engagementTelemetry.onChange.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListener: () => {
          throw Error(`Browser.urlbar.engagementTelemetry.onChange.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        },
        hasListeners: () => {
          throw Error(`Browser.urlbar.engagementTelemetry.onChange.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
        }
      }
    }
  },
  userScripts: {
    register: () => {
      throw Error(`Browser.userScripts.register not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    }
  },
  webNavigation: {
    getFrame: () => {
      throw Error(`Browser.webNavigation.getFrame not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAllFrames: () => {
      throw Error(`Browser.webNavigation.getAllFrames not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onBeforeNavigate: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onBeforeNavigate.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onBeforeNavigate.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onBeforeNavigate.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onBeforeNavigate.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onCommitted: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onCommitted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onCommitted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onCommitted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onCommitted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onDOMContentLoaded: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onDOMContentLoaded.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onDOMContentLoaded.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onDOMContentLoaded.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onDOMContentLoaded.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onCompleted: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onCompleted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onCompleted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onCompleted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onCompleted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onErrorOccurred: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onErrorOccurred.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onErrorOccurred.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onErrorOccurred.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onErrorOccurred.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onCreatedNavigationTarget: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onCreatedNavigationTarget.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onCreatedNavigationTarget.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onCreatedNavigationTarget.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onCreatedNavigationTarget.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onReferenceFragmentUpdated: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onReferenceFragmentUpdated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onReferenceFragmentUpdated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onReferenceFragmentUpdated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onReferenceFragmentUpdated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onTabReplaced: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onTabReplaced.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onTabReplaced.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onTabReplaced.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onTabReplaced.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onHistoryStateUpdated: {
      addListener: () => {
        throw Error(`Browser.webNavigation.onHistoryStateUpdated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webNavigation.onHistoryStateUpdated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webNavigation.onHistoryStateUpdated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webNavigation.onHistoryStateUpdated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    }
  },
  webRequest: {
    handlerBehaviorChanged: () => {
      throw Error(`Browser.webRequest.handlerBehaviorChanged not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    filterResponseData: () => {
      throw Error(`Browser.webRequest.filterResponseData not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getSecurityInfo: () => {
      throw Error(`Browser.webRequest.getSecurityInfo not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onBeforeRequest: {
      addListener: () => {
        throw Error(`Browser.webRequest.onBeforeRequest.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onBeforeRequest.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onBeforeRequest.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onBeforeRequest.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onBeforeSendHeaders: {
      addListener: () => {
        throw Error(`Browser.webRequest.onBeforeSendHeaders.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onBeforeSendHeaders.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onBeforeSendHeaders.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onBeforeSendHeaders.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onSendHeaders: {
      addListener: () => {
        throw Error(`Browser.webRequest.onSendHeaders.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onSendHeaders.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onSendHeaders.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onSendHeaders.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onHeadersReceived: {
      addListener: () => {
        throw Error(`Browser.webRequest.onHeadersReceived.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onHeadersReceived.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onHeadersReceived.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onHeadersReceived.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onAuthRequired: {
      addListener: () => {
        throw Error(`Browser.webRequest.onAuthRequired.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onAuthRequired.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onAuthRequired.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onAuthRequired.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onResponseStarted: {
      addListener: () => {
        throw Error(`Browser.webRequest.onResponseStarted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onResponseStarted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onResponseStarted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onResponseStarted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onBeforeRedirect: {
      addListener: () => {
        throw Error(`Browser.webRequest.onBeforeRedirect.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onBeforeRedirect.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onBeforeRedirect.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onBeforeRedirect.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onCompleted: {
      addListener: () => {
        throw Error(`Browser.webRequest.onCompleted.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onCompleted.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onCompleted.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onCompleted.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onErrorOccurred: {
      addListener: () => {
        throw Error(`Browser.webRequest.onErrorOccurred.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.webRequest.onErrorOccurred.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.webRequest.onErrorOccurred.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.webRequest.onErrorOccurred.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES: 20
  },
  windows: {
    get: () => {
      throw Error(`Browser.windows.get not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getCurrent: () => {
      throw Error(`Browser.windows.getCurrent not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getLastFocused: () => {
      throw Error(`Browser.windows.getLastFocused not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    getAll: () => {
      throw Error(`Browser.windows.getAll not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    create: () => {
      throw Error(`Browser.windows.create not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    update: () => {
      throw Error(`Browser.windows.update not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    remove: () => {
      throw Error(`Browser.windows.remove not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
    },
    onCreated: {
      addListener: () => {
        throw Error(`Browser.windows.onCreated.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.windows.onCreated.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.windows.onCreated.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.windows.onCreated.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onRemoved: {
      addListener: () => {
        throw Error(`Browser.windows.onRemoved.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.windows.onRemoved.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.windows.onRemoved.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.windows.onRemoved.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    onFocusChanged: {
      addListener: () => {
        throw Error(`Browser.windows.onFocusChanged.addListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      removeListener: () => {
        throw Error(`Browser.windows.onFocusChanged.removeListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListener: () => {
        throw Error(`Browser.windows.onFocusChanged.hasListener not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      },
      hasListeners: () => {
        throw Error(`Browser.windows.onFocusChanged.hasListeners not implemented.

Mock the function yourself using your testing framework, or submit a PR with an in-memory implementation.`);
      }
    },
    WINDOW_ID_NONE: -1,
    WINDOW_ID_CURRENT: -2
  }
};

// src/index.ts
import merge from "lodash.merge";
var overrides = {
  reset() {
    var _a;
    for (const [name, api] of Object.entries(fakeBrowser)) {
      if (name !== "reset")
        (_a = api.resetState) == null ? void 0 : _a.call(api);
    }
  },
  // Implemented
  alarms,
  notifications,
  runtime,
  storage,
  tabs,
  webNavigation,
  windows
};
var fakeBrowser = merge(GeneratedBrowser, overrides);
export {
  fakeBrowser
};
