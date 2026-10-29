"use strict";
const electron = require("electron");
const INVOKE_CHANNELS = /* @__PURE__ */ new Set([
  "session:get",
  "session:removeRecent",
  "library:create",
  "library:open",
  "library:close",
  "library:info",
  "library:getSidebarCounts",
  "item:import",
  "item:get",
  "item:update",
  "item:delete",
  "item:restore",
  "item:purge",
  "item:checkDuplicate",
  "item:importWithResolution",
  "search:query",
  "folder:create",
  "folder:rename",
  "folder:update",
  "folder:delete",
  "folder:list",
  "dialog:openLibrary",
  "dialog:pickFiles",
  "shell:openExternal",
  "window:minimize",
  "window:maximize",
  "window:close",
  "clipboard:writeFiles",
  "clipboard:readImage",
  "file:dataUrl"
]);
const EVENT_CHANNELS = /* @__PURE__ */ new Set([
  "event:item-added",
  "event:item-updated",
  "event:item-removed",
  "event:index-ready",
  "event:import-progress"
]);
electron.contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel))
      return Promise.reject(new Error(`Blocked: ${channel}`));
    return electron.ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, cb) => {
    if (!EVENT_CHANNELS.has(channel)) return () => {
    };
    const handler = (_, ...args) => cb(...args);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  }
});
