/** 粒子计数通道：0.3μm、0.5μm、5.0μm */
export type Channel = "p03" | "p05" | "p5";

/** 某 ISO 等级三个通道的粒子浓度上限（粒/m³） */
export interface ParticleLimits {
  p03: number;
  p05: number;
  p5: number;
}

export type VersionStatus = "draft" | "published";

/** 限值版本：草稿可改但不参与判定；发布后冻结，只能再发新版本 */
export interface LimitVersion {
  id: string;
  versionNo: number;
  status: VersionStatus;
  /** 版本说明 / 发布说明 */
  note: string;
  createdAt: number;
  publishedAt: number | null;
  /** 每个 ISO 等级一份上限，版本内整体冻结 */
  limits: Record<string, ParticleLimits>;
}

export type RecordKind = "normal" | "correction";
export type Verdict = "normal" | "abnormal";

/** 巡检记录：限值快照与结论随记录永久保留，新版本发布不影响旧记录 */
export interface InspectionRecord {
  id: string;
  kind: RecordKind;
  roomId: string;
  isoClass: string;
  inspector: string;
  /** 实测计数 */
  counts: Record<Channel, number>;
  /** 越界通道 */
  exceeded: Channel[];
  verdict: Verdict;
  /** 判定时使用的版本（快照来源） */
  versionId: string;
  versionNo: number;
  /** 判定时刻的限值快照，后续任何版本发布都不会改动它 */
  limitsSnapshot: ParticleLimits;
  inspectedAt: number;
  createdAt: number;
  note?: string;
  /** 修正（补录）记录专用：原因与关联的原记录 */
  reason?: string;
  originalRecordId?: string;
}

export interface AppState {
  /** 版本号自增序列，保证编号不回收 */
  seq: number;
  versions: LimitVersion[];
  records: InspectionRecord[];
}
