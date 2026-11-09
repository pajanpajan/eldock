// Fáze 71: most mezi rozhraním (sandbox, izolace kontextu) a hlavním procesem – jen úzké API `window.eldock`.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("eldock", {
  token: {
    get: (): Promise<string | null> => ipcRenderer.invoke("eldock:token-get"),
    set: (token: string): Promise<void> => ipcRenderer.invoke("eldock:token-set", token),
    clear: (): Promise<void> => ipcRenderer.invoke("eldock:token-clear"),
  },
  appInfo: (): Promise<{ version: string; hostname: string; platform: string; encrypted: boolean }> => ipcRenderer.invoke("eldock:app-info"),
  openFile: (name: string, data: ArrayBuffer): Promise<string> => ipcRenderer.invoke("eldock:open-file", name, new Uint8Array(data)),
  takeDeepLink: (): Promise<string | null> => ipcRenderer.invoke("eldock:deep-link-take"),
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("eldock:deep-link", listener);
    return () => {
      ipcRenderer.removeListener("eldock:deep-link", listener);
    };
  },
});
