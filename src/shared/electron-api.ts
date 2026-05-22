import type { MatchState } from "../domain/types";

export type MenuCommand = "new-match" | "open-match" | "save-match" | "export-match";

export type PersistenceErrorCode =
  | "corrupt_json"
  | "unsupported_schema_version"
  | "invalid_match_schema"
  | "file_io_error";

export interface PersistenceError {
  code: PersistenceErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type FileDialogResult =
  | { canceled: true }
  | {
      canceled: false;
      ok: true;
      filePath: string;
      matchState?: MatchState;
    }
  | {
      canceled: false;
      ok: false;
      filePath?: string;
      error: PersistenceError;
    };

export type AutosaveResult =
  | {
      ok: true;
      filePath: string;
    }
  | {
      ok: false;
      error: PersistenceError;
    };

export type LoadAutosaveResult =
  | {
      ok: true;
      filePath: string;
      matchState: MatchState | null;
    }
  | {
      ok: false;
      filePath: string;
      error: PersistenceError;
    };

export interface AutosaveMatchRequest {
  matchState: MatchState;
}

export interface SaveMatchRequest {
  matchState: MatchState;
  defaultPath?: string;
}

export interface ExportMatchRequest {
  matchState: MatchState;
  defaultPath?: string;
}

export interface ElectronApi {
  getAppVersion: () => Promise<string>;
  loadAutosave: () => Promise<LoadAutosaveResult>;
  autosaveMatch: (request: AutosaveMatchRequest) => Promise<AutosaveResult>;
  openMatch: () => Promise<FileDialogResult>;
  saveMatch: (request: SaveMatchRequest) => Promise<FileDialogResult>;
  exportMatch: (request: ExportMatchRequest) => Promise<FileDialogResult>;
  onMenuCommand: (callback: (command: MenuCommand) => void) => () => void;
}
