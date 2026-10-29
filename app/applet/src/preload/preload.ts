import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'library:moveToTrash',
      'library:restoreFromTrash',
      'library:permanentlyDelete',
      'library:emptyTrash',
      'library:getItems'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['library:importProgress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});
