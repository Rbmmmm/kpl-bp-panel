import { contextBridge, ipcRenderer } from "electron";
import type {
  AutosaveMatchRequest,
  ElectronApi,
  ExportMatchRequest,
  MenuCommand,
  SaveMatchRequest
} from "../src/shared/electron-api";

const api: ElectronApi = {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  loadAutosave: () => ipcRenderer.invoke("match:load-autosave"),
  autosaveMatch: (request: AutosaveMatchRequest) => ipcRenderer.invoke("match:autosave", request),
  openMatch: () => ipcRenderer.invoke("dialog:open-match"),
  saveMatch: (request: SaveMatchRequest) => ipcRenderer.invoke("dialog:save-match", request),
  exportMatch: (request: ExportMatchRequest) => ipcRenderer.invoke("dialog:export-match", request),
  onMenuCommand: (callback: (command: MenuCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => {
      callback(command);
    };

    ipcRenderer.on("menu:command", listener);
    return () => ipcRenderer.removeListener("menu:command", listener);
  }
};

contextBridge.exposeInMainWorld("kplBpPanel", api);
