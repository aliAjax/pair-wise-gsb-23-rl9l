import { baseLimits } from "./domain";
import type { AppState, InspectionRecord, LimitVersion } from "./types";

export const STORAGE_KEY = "hxwl09.state.v1";
export const SEED_INSPECTOR = "张工";

/** 首个发布版本：ISO 14644-1:2015 出厂限值 */
export const BASE_SEED_VERSION: LimitVersion = {
  id: "ver-v1",
  versionNo: 1,
  status: "published",
  note: "初始发布：按 ISO 14644-1:2015 各等级浓度上限执行",
  createdAt: 0,
  publishedAt: 0,
  limits: baseLimits(),
};

/** 示例记录：在首次打开时生成，时间锚定到"当下"，限值快照取自 v1 */
export function buildSeedState(): AppState {
  const now = Date.now();
  const v1: LimitVersion = {
    ...BASE_SEED_VERSION,
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    publishedAt: now - 1000 * 60 * 60 * 24 * 30,
  };
  const iso5 = v1.limits["ISO 5"];
  const iso6 = v1.limits["ISO 6"];

  const abnormal: InspectionRecord = {
    id: "rec-seed-1",
    kind: "normal",
    roomId: "CR-1201",
    isoClass: "ISO 5",
    inspector: SEED_INSPECTOR,
    counts: { p03: 9_800, p05: 4_200, p5: 12 },
    exceeded: ["p05"],
    verdict: "abnormal",
    versionId: v1.id,
    versionNo: 1,
    limitsSnapshot: { ...iso5 },
    inspectedAt: now - 1000 * 60 * 60 * 26,
    createdAt: now - 1000 * 60 * 60 * 26,
    note: "0.5μm 粒子超限，已通知厂务排查回风",
  };

  const normal: InspectionRecord = {
    id: "rec-seed-2",
    kind: "normal",
    roomId: "CR-2107",
    isoClass: "ISO 6",
    inspector: SEED_INSPECTOR,
    counts: { p03: 80_000, p05: 28_000, p5: 120 },
    exceeded: [],
    verdict: "normal",
    versionId: v1.id,
    versionNo: 1,
    limitsSnapshot: { ...iso6 },
    inspectedAt: now - 1000 * 60 * 60 * 5,
    createdAt: now - 1000 * 60 * 60 * 5,
    note: "压差 15Pa，温湿度正常",
  };

  return { seq: 1, versions: [v1], records: [abnormal, normal] };
}
