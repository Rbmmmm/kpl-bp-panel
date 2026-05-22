import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AutosaveMatchRequest,
  AutosaveResult,
  ExportMatchRequest,
  FileDialogResult,
  LoadAutosaveResult,
  MenuCommand,
  PersistenceError,
  SaveMatchRequest
} from "../src/shared/electron-api";
import {
  createPersistenceError,
  parseMatchJson,
  serializeMatchState
} from "../src/shared/match-persistence";

let mainWindow: BrowserWindow | null = null;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function getRendererEntry(): string {
  return path.join(__dirname, "..", "..", "dist", "index.html");
}

function sendMenuCommand(command: MenuCommand): void {
  mainWindow?.webContents.send("menu:command", command);
}

function getAutosavePath(): string {
  return path.join(app.getPath("userData"), "autosave", "current-match.json");
}

function createApplicationMenu(): void {
  const isMac = process.platform === "darwin";

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }]
          } satisfies Electron.MenuItemConstructorOptions
        ]
      : []),
    {
      label: "比赛",
      submenu: [
        {
          label: "新建比赛",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuCommand("new-match")
        },
        {
          label: "打开比赛",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuCommand("open-match")
        },
        {
          label: "保存比赛",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuCommand("save-match")
        },
        {
          label: "导出比赛",
          accelerator: "CmdOrCtrl+E",
          click: () => sendMenuCommand("export-match")
        },
        { type: "separator" },
        { role: "quit", label: isMac ? "退出 KPL BP Panel" : "退出" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 420,
    minHeight: 520,
    title: "KPL BO7 BP 模拟器",
    backgroundColor: "#08111f",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(getRendererEntry());
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function writeJsonFile(filePath: string, value: SaveMatchRequest["matchState"]): Promise<FileDialogResult> {
  const serialized = serializeMatchState(value);
  if (!serialized.ok || !serialized.json) {
    return {
      canceled: false,
      ok: false,
      filePath,
      error: serialized.ok ? createPersistenceError("invalid_match_schema") : serialized.error
    };
  }

  try {
    await writeTextFileAtomic(filePath, serialized.json);
    return { canceled: false, ok: true, filePath };
  } catch (error) {
    return {
      canceled: false,
      ok: false,
      filePath,
      error: toFileIoError(error)
    };
  }
}

async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf-8");
  await fs.rename(temporaryPath, filePath);
}

async function readMatchFile(filePath: string): Promise<FileDialogResult> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = parseMatchJson(raw);

    if (!parsed.ok) {
      return {
        canceled: false,
        ok: false,
        filePath,
        error: parsed.error
      };
    }

    return {
      canceled: false,
      ok: true,
      filePath,
      matchState: parsed.matchState
    };
  } catch (error) {
    return {
      canceled: false,
      ok: false,
      filePath,
      error: toFileIoError(error)
    };
  }
}

function toFileIoError(error: unknown): PersistenceError {
  return createPersistenceError("file_io_error", {
    reason: error instanceof Error ? error.message : String(error)
  });
}

function showOpenMatchDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  return mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options);
}

function showSaveMatchDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  return mainWindow ? dialog.showSaveDialog(mainWindow, options) : dialog.showSaveDialog(options);
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("match:load-autosave", async (): Promise<LoadAutosaveResult> => {
    const filePath = getAutosavePath();

    try {
      await fs.access(filePath);
    } catch {
      return { ok: true, filePath, matchState: null };
    }

    const result = await readMatchFile(filePath);
    if (result.canceled) {
      return { ok: true, filePath, matchState: null };
    }

    if (!result.ok) {
      return { ok: false, filePath, error: result.error };
    }

    return { ok: true, filePath, matchState: result.matchState ?? null };
  });

  ipcMain.handle("match:autosave", async (_event, request: AutosaveMatchRequest): Promise<AutosaveResult> => {
    const filePath = getAutosavePath();
    const result = await writeJsonFile(filePath, request.matchState);

    if (result.canceled) {
      return {
        ok: false,
        error: createPersistenceError("file_io_error", { reason: "autosave_canceled_unexpectedly" })
      };
    }

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, filePath };
  });

  ipcMain.handle("dialog:open-match", async (): Promise<FileDialogResult> => {
    const result = await showOpenMatchDialog({
      title: "打开比赛文件",
      properties: ["openFile"],
      filters: [{ name: "KPL BP 比赛文件", extensions: ["json"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    return readMatchFile(filePath);
  });

  ipcMain.handle(
    "dialog:save-match",
    async (_event, request: SaveMatchRequest): Promise<FileDialogResult> => {
      const result = await showSaveMatchDialog({
        title: "保存比赛文件",
        defaultPath: request.defaultPath ?? "kpl-bo7-match.json",
        filters: [{ name: "KPL BP 比赛文件", extensions: ["json"] }]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      return writeJsonFile(result.filePath, request.matchState);
    }
  );

  ipcMain.handle(
    "dialog:export-match",
    async (_event, request: ExportMatchRequest): Promise<FileDialogResult> => {
      const result = await showSaveMatchDialog({
        title: "导出比赛结果",
        defaultPath: request.defaultPath ?? "kpl-bo7-match-export.json",
        filters: [{ name: "JSON 文件", extensions: ["json"] }]
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      return writeJsonFile(result.filePath, request.matchState);
    }
  );
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  createApplicationMenu();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
