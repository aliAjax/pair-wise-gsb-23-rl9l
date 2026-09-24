export const CHANNELS = ["0.3", "0.5", "5.0"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  "0.3": "0.3μm",
  "0.5": "0.5μm",
  "5.0": "5.0μm",
};

export type IsoClassId = "iso5" | "iso6" | "iso7" | "iso8";

export interface IsoClass {
  id: IsoClassId;
  label: string;
}

export const ISO_CLASSES: IsoClass[] = [
  { id: "iso5", label: "ISO 5" },
  { id: "iso6", label: "ISO 6" },
  { id: "iso7", label: "ISO 7" },
  { id: "iso8", label: "ISO 8" },
];

/** 单个 ISO 等级三个粒径通道的上限（粒/m³），null 表示该通道不设限 */
export type ClassLimits = Record<Channel, number | null>;
export type LimitsMatrix = Record<IsoClassId, ClassLimits>;
export type DraftMatrix = Record<IsoClassId, Record<Channel, string>>;

export interface LimitVersion {
  id: string;
  /** 版本号 V1、V2…… */
  code: string;
  status: "draft" | "published";
  note: string;
  createdAt: number;
  publishedAt: number | null;
  limits: LimitsMatrix;
}

export interface Room {
  id: string;
  name: string;
  classId: IsoClassId;
  zone: string;
}

export interface Violation {
  channel: Channel;
  value: number;
  limit: number;
}

export interface InspectionRecord {
  id: string;
  kind: "routine" | "correction";
  roomId: string;
  roomName: string;
  classId: IsoClassId;
  /** 判定所依据的版本（外键） */
  versionId: string;
  versionCode: string;
  sampledAt: number;
  recordedAt: number;
  inspector: string;
  counts: Record<Channel, number>;
  /** 提交时刻冻结的限值快照，保证旧结论不随后续版本变化 */
  limitsSnapshot: ClassLimits;
  violations: Violation[];
  status: "normal" | "abnormal";
  handled: boolean;
  handleNote?: string;
  /** 修正记录必填：修正原因 */
  reason?: string;
  /** 修正记录指向原巡检记录 */
  correctsId?: string;
}

export interface PersistState {
  schema: 1;
  versions: LimitVersion[];
  rooms: Room[];
  records: InspectionRecord[];
}

export interface RoutineInput {
  roomId: string;
  versionId: string;
  sampledAt: number;
  inspector: string;
  counts: Record<Channel, number>;
}

export interface CorrectionInput {
  correctsId: string;
  sampledAt: number;
  inspector: string;
  counts: Record<Channel, number>;
  reason: string;
}
