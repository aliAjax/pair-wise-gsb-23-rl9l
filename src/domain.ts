import {
  CHANNELS,
  CHANNEL_LABEL,
  ISO_CLASSES,
  type Channel,
  type ClassLimits,
  type CorrectionInput,
  type InspectionRecord,
  type IsoClassId,
  type LimitVersion,
  type LimitsMatrix,
  type PersistState,
  type Room,
  type RoutineInput,
  type Violation,
} from "./types";

const STORAGE_KEY = "cleanroom-limit-console:v1";

/* ---------------- 限值矩阵 ---------------- */

export function emptyLimits(): LimitsMatrix {
  const row = (): ClassLimits => ({ "0.3": null, "0.5": null, "5.0": null });
  return { iso5: row(), iso6: row(), iso7: row(), iso8: row() };
}

function matrix(row: Record<IsoClassId, [number, number, number]>): LimitsMatrix {
  const out = emptyLimits();
  (Object.keys(row) as IsoClassId[]).forEach((id) => {
    out[id] = { "0.3": row[id][0], "0.5": row[id][1], "5.0": row[id][2] };
  });
  return out;
}

/* 按 ISO 14644-1:2015 表 1 换算的初始基线（粒/m³） */
const ISO_BASELINE: Record<IsoClassId, [number, number, number]> = {
  iso5: [10200, 3520, 29],
  iso6: [102000, 35200, 293],
  iso7: [352000, 352000, 2930],
  iso8: [3520000, 3520000, 29300],
};

function v1Limits(): LimitsMatrix {
  return matrix(ISO_BASELINE);
}

function v2Limits(): LimitsMatrix {
  const m = matrix(ISO_BASELINE);
  // V2 对高级别区收紧 0.5μm 与 5.0μm
  m.iso5["0.5"] = 3200;
  m.iso5["5.0"] = 20;
  m.iso6["5.0"] = 250;
  return m;
}

function v3DraftLimits(): LimitsMatrix {
  const m = v2Limits();
  m.iso7["0.5"] = 300000;
  return m;
}

/* ---------------- 种子数据 ---------------- */

const DAY = 24 * 60 * 60 * 1000;

function buildRecord(
  seq: number,
  partial: Omit<InspectionRecord, "id" | "recordedAt" | "limitsSnapshot" | "violations" | "status">
): InspectionRecord {
  return {
    id: `INS-${String(seq).padStart(4, "0")}`,
    recordedAt: partial.sampledAt + 20 * 60 * 1000,
    ...partial,
  } as InspectionRecord;
}

function finalize(
  rec: InspectionRecord,
  versions: LimitVersion[]
): InspectionRecord {
  const version = versions.find((v) => v.id === rec.versionId);
  if (!version) throw new Error("seed record missing version");
  const snapshot: ClassLimits = { ...version.limits[rec.classId] };
  const violations = evaluate(rec.counts, snapshot);
  return {
    ...rec,
    limitsSnapshot: snapshot,
    violations,
    status: violations.length ? "abnormal" : "normal",
  };
}

function seedState(): PersistState {
  const now = Date.now();

  const v1: LimitVersion = {
    id: "ver-v1",
    code: "V1",
    status: "published",
    note: "初始发布：按 ISO 14644-1:2015 表 1 设定各等级 0.3/0.5/5.0μm 上限。",
    createdAt: now - 40 * DAY,
    publishedAt: now - 38 * DAY,
    limits: v1Limits(),
  };
  const v2: LimitVersion = {
    id: "ver-v2",
    code: "V2",
    status: "published",
    note: "收紧 ISO 5 的 0.5μm/5.0μm 与 ISO 6 的 5.0μm 管控，降低高级别区风险。",
    createdAt: now - 13 * DAY,
    publishedAt: now - 12 * DAY,
    limits: v2Limits(),
  };
  const v3: LimitVersion = {
    id: "ver-v3",
    code: "V3",
    status: "draft",
    note: "拟进一步收紧 ISO 7 的 0.5μm 上限，待评审。",
    createdAt: now - 1 * DAY,
    publishedAt: null,
    limits: v3DraftLimits(),
  };

  const rooms: Room[] = [
    { id: "CR-1201", name: "光刻间 1201", classId: "iso5", zone: "黄光区" },
    { id: "CR-1305", name: "刻蚀间 1305", classId: "iso6", zone: "刻蚀区" },
    { id: "CR-2208", name: "薄膜间 2208", classId: "iso6", zone: "薄膜区" },
    { id: "CR-3102", name: "组装间 3102", classId: "iso7", zone: "组装区" },
  ];

  const versions = [v1, v2, v3];
  const draft: InspectionRecord[] = [];

  draft.push(
    buildRecord(1, {
      kind: "routine",
      roomId: "CR-1201",
      roomName: rooms[0].name,
      classId: "iso5",
      versionId: v1.id,
      versionCode: v1.code,
      sampledAt: now - 20 * DAY,
      inspector: "王巡检",
      counts: { "0.3": 8600, "0.5": 3380, "5.0": 12 },
      handled: true,
      handleNote: "初始基线记录，各项正常。",
    })
  );

  draft.push(
    buildRecord(2, {
      kind: "routine",
      roomId: "CR-1305",
      roomName: rooms[1].name,
      classId: "iso6",
      versionId: v2.id,
      versionCode: v2.code,
      sampledAt: now - 6 * DAY,
      inspector: "李巡检",
      counts: { "0.3": 76000, "0.5": 21000, "5.0": 268 },
      handled: false,
    })
  );

  draft.push(
    buildRecord(3, {
      kind: "correction",
      roomId: "CR-1305",
      roomName: rooms[1].name,
      classId: "iso6",
      versionId: v2.id,
      versionCode: v2.code,
      sampledAt: now - 5 * DAY,
      inspector: "李巡检",
      counts: { "0.3": 72000, "0.5": 18500, "5.0": 160 },
      handled: true,
      handleNote: "复测合格，关闭异常。",
      reason: "初检后更换回风高效过滤器，按规程补录复测计数。",
      correctsId: "INS-0002",
    })
  );

  draft.push(
    buildRecord(4, {
      kind: "routine",
      roomId: "CR-3102",
      roomName: rooms[3].name,
      classId: "iso7",
      versionId: v2.id,
      versionCode: v2.code,
      sampledAt: now - 2 * DAY,
      inspector: "赵巡检",
      counts: { "0.3": 210000, "0.5": 128000, "5.0": 900 },
      handled: true,
      handleNote: "例行巡检合格。",
    })
  );

  const records = draft.map((r) => finalize(r, versions));

  return { schema: 1, versions, rooms, records };
}

/* ---------------- 持久化 ---------------- */

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistState;
      if (parsed.schema === 1 && Array.isArray(parsed.versions)) return parsed;
    }
  } catch {
    // 数据损坏时回退到种子数据
  }
  return seedState();
}

export function saveState(state: PersistState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时仅保留内存态
  }
}

export function resetState(): PersistState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

/* ---------------- 判定逻辑 ---------------- */

export function evaluate(counts: Record<Channel, number>, limits: ClassLimits): Violation[] {
  const out: Violation[] = [];
  for (const channel of CHANNELS) {
    const limit = limits[channel];
    if (limit !== null && counts[channel] > limit) {
      out.push({ channel, value: counts[channel], limit });
    }
  }
  return out;
}

export function makeRoutineRecord(
  input: RoutineInput,
  version: LimitVersion,
  room: Room,
  seq: number
): InspectionRecord {
  const limitsSnapshot = { ...version.limits[room.classId] };
  const violations = evaluate(input.counts, limitsSnapshot);
  const sampledAt = input.sampledAt;
  return {
    id: `INS-${String(seq).padStart(4, "0")}`,
    kind: "routine",
    roomId: room.id,
    roomName: room.name,
    classId: room.classId,
    versionId: version.id,
    versionCode: version.code,
    sampledAt,
    recordedAt: Date.now(),
    inspector: input.inspector.trim(),
    counts: { ...input.counts },
    limitsSnapshot,
    violations,
    status: violations.length ? "abnormal" : "normal",
    handled: false,
  };
}

export function makeCorrectionRecord(
  input: CorrectionInput,
  version: LimitVersion,
  original: InspectionRecord,
  seq: number
): InspectionRecord {
  const limitsSnapshot = { ...version.limits[original.classId] };
  const violations = evaluate(input.counts, limitsSnapshot);
  return {
    id: `INS-${String(seq).padStart(4, "0")}`,
    kind: "correction",
    roomId: original.roomId,
    roomName: original.roomName,
    classId: original.classId,
    versionId: version.id,
    versionCode: version.code,
    sampledAt: input.sampledAt,
    recordedAt: Date.now(),
    inspector: input.inspector.trim(),
    counts: { ...input.counts },
    limitsSnapshot,
    violations,
    status: violations.length ? "abnormal" : "normal",
    handled: false,
    reason: input.reason.trim(),
    correctsId: input.correctsId,
  };
}

/* ---------------- 选择器与格式化 ---------------- */

export function publishedVersions(versions: LimitVersion[]): LimitVersion[] {
  return versions
    .filter((v) => v.status === "published")
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
}

export function latestPublished(versions: LimitVersion[]): LimitVersion | undefined {
  return publishedVersions(versions)[0];
}

export function classLabel(id: IsoClassId): string {
  return ISO_CLASSES.find((c) => c.id === id)?.label ?? id;
}

export function formatCount(value: number | null): string {
  if (value === null) return "不设限";
  return value.toLocaleString("zh-CN");
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalInputValue(value: string): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/** 解析计数输入：非负整数，空值按 0 处理（录入场景三通道必填） */
export function parseCount(value: string): number | null {
  const t = value.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (n > 99_999_999) return null;
  return n;
}

export function channelText(channel: Channel): string {
  return CHANNEL_LABEL[channel];
}
