import type { MatchState } from "../domain";
import type {
  AutosaveResult,
  FileDialogResult,
  LoadAutosaveResult,
  PersistenceError
} from "../shared/electron-api";
import { createPersistenceError, parseMatchJson, serializeMatchState } from "../shared/match-persistence";

const AUTOSAVE_KEY = "kpl-bp-autosave";

export function loadBrowserAutosave(): LoadAutosaveResult {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) {
      return { ok: true, filePath: "浏览器本地存储", matchState: null };
    }

    const parsed = parseMatchJson(raw);
    if (!parsed.ok) {
      return { ok: false, filePath: "浏览器本地存储", error: parsed.error };
    }

    return { ok: true, filePath: "浏览器本地存储", matchState: parsed.matchState };
  } catch (error) {
    return {
      ok: false,
      filePath: "浏览器本地存储",
      error: createPersistenceError("file_io_error", {
        reason: error instanceof Error ? error.message : String(error)
      })
    };
  }
}

export function saveBrowserAutosave(matchState: MatchState): AutosaveResult {
  try {
    const serialized = serializeMatchState(matchState);
    if (!serialized.ok || !serialized.json) {
      return {
        ok: false,
        error: serialized.ok ? createPersistenceError("invalid_match_schema") : serialized.error
      };
    }

    localStorage.setItem(AUTOSAVE_KEY, serialized.json);
    return { ok: true, filePath: "浏览器本地存储" };
  } catch (error) {
    return {
      ok: false,
      error: createPersistenceError("file_io_error", {
        reason: error instanceof Error ? error.message : String(error)
      })
    };
  }
}

export function downloadMatchFile(matchState: MatchState, defaultFileName: string): FileDialogResult {
  try {
    const serialized = serializeMatchState(matchState);
    if (!serialized.ok || !serialized.json) {
      return {
        canceled: false,
        ok: false,
        error: serialized.ok ? createPersistenceError("invalid_match_schema") : serialized.error
      };
    }

    const blob = new Blob([serialized.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = defaultFileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    return { canceled: false, ok: true, filePath: defaultFileName };
  } catch (error) {
    return {
      canceled: false,
      ok: false,
      error: createPersistenceError("file_io_error", {
        reason: error instanceof Error ? error.message : String(error)
      })
    };
  }
}

export function openMatchFile(): Promise<FileDialogResult> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ canceled: true });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const raw = typeof reader.result === "string" ? reader.result : "";
        if (!raw) {
          resolve({
            canceled: false,
            ok: false,
            error: createPersistenceError("corrupt_json", { reason: "文件为空" })
          });
          return;
        }

        const parsed = parseMatchJson(raw);
        if (!parsed.ok) {
          resolve({ canceled: false, ok: false, error: parsed.error });
          return;
        }

        resolve({
          canceled: false,
          ok: true,
          filePath: file.name,
          matchState: parsed.matchState
        });
      };

      reader.onerror = () => {
        resolve({
          canceled: false,
          ok: false,
          error: createPersistenceError("file_io_error", {
            reason: reader.error?.message ?? "文件读取失败"
          })
        });
      };

      reader.readAsText(file);
    };

    input.oncancel = () => {
      resolve({ canceled: true });
    };

    input.click();
  });
}
