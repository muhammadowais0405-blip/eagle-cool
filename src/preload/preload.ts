import { contextBridge, ipcRenderer } from 'electron'

const INVOKE_CHANNELS = new Set([
  'session:get', 'session:removeRecent',
  'library:create','library:open','library:close','library:info','library:getSidebarCounts', 'library:repair',
  'library:setWatchFolder','library:removeWatchFolder','library:getWatchFolders',
  'item:import','item:get','item:update','item:delete','item:restore','item:purge','item:checkDuplicate','item:importWithResolution',
  'item:importFromUrl', 'item:startNativeDrag',
  'search:query', 'search:similar',
  'folder:create','folder:rename','folder:update','folder:delete','folder:list',
  'dialog:openLibrary','dialog:pickFiles', 'dialog:pickFolders', 'dialog:pickExportFolder', 'dialog:checkHasLibrary',
  'shell:openExternal', 'shell:openPath',
  'window:minimize','window:maximize','window:close', 'window:set-theme',
  'clipboard:writeFiles',
  'clipboard:readImage',
  'file:dataUrl',
  'web:getMetadata',
  'session:set-ai-models-path',
  'enhance:getModels', 'enhance:start', 'enhance:startBatch', 'enhance:cancel', 'enhance:delete',
  'item:export', 'item:checkExportConflicts'
])

const EVENT_CHANNELS = new Set([
  'event:item-added','event:item-updated','event:item-removed','event:index-ready','event:import-progress','event:repair-progress',
  'event:enhance-progress', 'event:enhance-batch-progress', 'event:export-progress'
])

contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: any[]) => {
    if (!INVOKE_CHANNELS.has(channel))
      return Promise.reject(new Error(`Blocked: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, cb: (...args: any[]) => void) => {
    if (!EVENT_CHANNELS.has(channel)) return () => {}
    const handler = (_: any, ...args: any[]) => cb(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  platform: process.platform
})
