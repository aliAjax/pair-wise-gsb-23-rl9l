import {
  BASE_SEED_VERSION,
  buildSeedState,
  SEED_INSPECTOR,
  STORAGE_KEY,
} from "./seed";
import type { AppState, LimitVersion } from "./types";
import { uid } from "./domain";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.versions) && Array.isArray(parsed.records)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回退到示例数据
  }
  return buildSeedState();
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const INSPECTOR_NAME_KEY = "hxwl09.inspectorName";

export function loadInspectorName(): string {
  return localStorage.getItem(INSPECTOR_NAME_KEY) ?? SEED_INSPECTOR;
}

export function saveInspectorName(name: string): void {
  localStorage.setItem(INSPECTOR_NAME_KEY, name);
}

export function getDraft(state: AppState): LimitVersion | undefined {
  return state.versions.find((v) => v.status === "draft");
}

export function getPublished(state: AppState): LimitVersion[] {
  return state.versions
    .filter((v) => v.status === "published")
    .sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0));
}

export function getCurrentVersion(state: AppState): LimitVersion | undefined {
  return getPublished(state).at(-1);
}

/** 管理员新建草稿：复制当前生效版本的限值作为编辑起点 */
export function createDraft(state: AppState, note: string): AppState {
  if (getDraft(state)) return state;
  const current = getCurrentVersion(state);
  const limits = current
    ? JSON.parse(JSON.stringify(current.limits))
    : BASE_SEED_VERSION.limits;
  const now = Date.now();
  const draft: LimitVersion = {
    id: uid("ver"),
    versionNo: state.seq + 1,
    status: "draft",
    note,
    createdAt: now,
    publishedAt: null,
    limits,
  };
  return { ...state, seq: state.seq + 1, versions: [...state.versions, draft] };
}

export function updateDraftLimits(
  state: AppState,
  draftId: string,
  limits: LimitVersion["limits"]
): AppState {
  return {
    ...state,
    versions: state.versions.map((v) =>
      v.id === draftId && v.status === "draft" ? { ...v, limits } : v
    ),
  };
}

export function publishDraft(
  state: AppState,
  draftId: string,
  note: string
): AppState {
  return {
    ...state,
    versions: state.versions.map((v) =>
      v.id === draftId && v.status === "draft"
        ? { ...v, status: "published", note, publishedAt: Date.now() }
        : v
    ),
  };
}

export function discardDraft(state: AppState, draftId: string): AppState {
  return {
    ...state,
    versions: state.versions.filter(
      (v) => !(v.id === draftId && v.status === "draft")
    ),
  };
}
