import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clone,
  evaluate,
  loadState,
  makeCorrectionRecord,
  makeRoutineRecord,
  resetState,
  saveState,
} from "./domain";
import type {
  CorrectionInput,
  DraftMatrix,
  InspectionRecord,
  LimitVersion,
  PersistState,
  Room,
  RoutineInput,
} from "./types";

const ROLE_KEY = "cleanroom-limit-console:role";

export type Role = "admin" | "inspector";

export function loadRole(): Role {
  return localStorage.getItem(ROLE_KEY) === "inspector" ? "inspector" : "admin";
}

function nextSeq(records: InspectionRecord[]): number {
  return records.reduce((max, r) => {
    const n = Number(r.id.replace(/^INS-/, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0) + 1;
}

function nextVersionCode(versions: LimitVersion[]): string {
  return `V${versions.length + 1}`;
}

export function useStore() {
  const [state, setState] = useState<PersistState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const versions = useMemo(() => state.versions, [state.versions]);
  const records = useMemo(() => state.records, [state.records]);
  const rooms = useMemo(() => state.rooms, [state.rooms]);

  /* ---- 管理员：版本 ---- */

  const createDraft = useCallback(() => {
    const ref: { id?: string } = {};
    setState((prev) => {
      if (prev.versions.some((v) => v.status === "draft")) return prev;
      const newest = [...prev.versions]
        .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))[0];
      const created: LimitVersion = {
        id: `ver-${Date.now()}`,
        code: nextVersionCode(prev.versions),
        status: "draft",
        note: "",
        createdAt: Date.now(),
        publishedAt: null,
        limits: clone(newest.limits),
      };
      ref.id = created.id;
      return { ...prev, versions: [...prev.versions, created] };
    });
    return ref.id ?? null;
  }, []);

  const updateDraft = useCallback(
    (versionId: string, patch: { note?: string; limits?: DraftMatrix }) => {
      setState((prev) => ({
        ...prev,
        versions: prev.versions.map((v) => {
          if (v.id !== versionId || v.status !== "draft") return v;
          const next: LimitVersion = { ...v, note: patch.note ?? v.note };
          if (patch.limits) {
            const nextMatrix = patch.limits;
            const limits = clone(v.limits);
            (Object.keys(nextMatrix) as Array<keyof DraftMatrix>).forEach((classId) => {
              (Object.keys(nextMatrix[classId]) as Array<"0.3" | "0.5" | "5.0">).forEach((ch) => {
                const raw = nextMatrix[classId][ch].trim();
                limits[classId][ch] = raw === "" ? null : Number(raw);
              });
            });
            next.limits = limits;
          }
          return next;
        }),
      }));
    },
    []
  );

  const discardDraft = useCallback((versionId: string) => {
    setState((prev) => ({
      ...prev,
      versions: prev.versions.filter((v) => !(v.id === versionId && v.status === "draft")),
    }));
  }, []);

  const publishDraft = useCallback((versionId: string) => {
    setState((prev) => ({
      ...prev,
      versions: prev.versions.map((v) =>
        v.id === versionId && v.status === "draft"
          ? { ...v, status: "published", publishedAt: Date.now() }
          : v
      ),
    }));
  }, []);

  /* ---- 巡检员：记录 ---- */

  const addRoutine = useCallback((input: RoutineInput): string | null => {
    let newId: string | null = null;
    setState((prev) => {
      const room = prev.rooms.find((r) => r.id === input.roomId);
      const version = prev.versions.find(
        (v) => v.id === input.versionId && v.status === "published"
      );
      // 草稿不参与判定：选不到已发布版本时拒绝写入
      if (!room || !version) return prev;
      const rec = makeRoutineRecord(input, version, room, nextSeq(prev.records));
      newId = rec.id;
      return { ...prev, records: [...prev.records, rec] };
    });
    return newId;
  }, []);

  const addCorrection = useCallback((input: CorrectionInput): string | null => {
    let newId: string | null = null;
    setState((prev) => {
      const original = prev.records.find((r) => r.id === input.correctsId);
      if (!original || original.kind === "correction") return prev;
      // 修正记录沿用原记录的判定版本，保证同口径复测
      const version = prev.versions.find(
        (v) => v.id === original.versionId && v.status === "published"
      );
      if (!version) return prev;
      const rec = makeCorrectionRecord(input, version, original, nextSeq(prev.records));
      newId = rec.id;
      return { ...prev, records: [...prev.records, rec] };
    });
    return newId;
  }, []);

  const markHandled = useCallback((recordId: string, note: string) => {
    setState((prev) => ({
      ...prev,
      records: prev.records.map((r) =>
        r.id === recordId && r.status === "abnormal"
          ? { ...r, handled: true, handleNote: note.trim() }
          : r
      ),
    }));
  }, []);

  const resetAll = useCallback(() => {
    setState(resetState());
  }, []);

  const getVersion = useCallback(
    (id: string) => versions.find((v) => v.id === id),
    [versions]
  );
  const getRoom = useCallback((id: string) => rooms.find((r) => r.id === id), [rooms]);

  return {
    versions,
    rooms,
    records,
    getVersion,
    getRoom,
    createDraft,
    updateDraft,
    discardDraft,
    publishDraft,
    addRoutine,
    addCorrection,
    markHandled,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;

export { evaluate };
