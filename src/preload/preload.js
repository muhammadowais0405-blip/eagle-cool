"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");

const INVOKE_CHANNELS = new Set([
  'session:get', 'session:removeRecent', 'session:set-ai-models-path',
  'library:create', 'library:open', 'library:close', 'library:info',
  'library:getSidebarCounts', 'library:repair',
  'library:setWatchFolder', 'library:removeWatchFolder', 'library:getWatchFolders',
  'item:import', 'item:get', 'item:update', 'item:delete', 'item:restore',
  'item:purge', 'item:checkDuplicate', 'item:importWithResolution',
  'item:importFromUrl', 'item:startNativeDrag',
  'item:export', 'item:checkExportConflicts',
  'search:query', 'search:similar',
  'folder:create', 'folder:rename', 'folder:update', 'folder:delete', 'folder:list',
  'dialog:openLibrary', 'dialog:pickFiles', 'dialog:pickFolders',
  'dialog:pickExportFolder', 'dialog:checkHasLibrary',
  'shell:openExternal', 'shell:openPath',
  'window:minimize', 'window:maximize', 'window:close', 'window:set-theme',
  'clipboard:writeFiles', 'clipboard:readImage',
  'file:dataUrl',
  'web:getMetadata',
  'enhance:getModels', 'enhance:start', 'enhance:startBatch',
  'enhance:cancel', 'enhance:delete',
]);

const EVENT_CHANNELS = new Set([
  'event:item-added', 'event:item-updated', 'event:item-removed',
  'event:index-ready', 'event:import-progress', 'event:repair-progress',
  'event:enhance-progress', 'event:enhance-batch-progress', 'event:export-progress',
]);

electron_1.contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel))
      return Promise.reject(new Error(`Blocked: ${channel}`));
    return electron_1.ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, cb) => {
    if (!EVENT_CHANNELS.has(channel)) return () => {};
    const handler = (_, ...args) => cb(...args);
    electron_1.ipcRenderer.on(channel, handler);
    return () => electron_1.ipcRenderer.removeListener(channel, handler);
  },
  platform: process.platform
});