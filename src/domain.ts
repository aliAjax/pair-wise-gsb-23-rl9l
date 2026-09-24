import type { Channel, ParticleLimits, Verdict } from "./types";

export interface Room {
  id: string;
  label: string;
  isoClass: string;
}

export const CHANNELS: ReadonlyArray<{ key: Channel; label: string }> = [
  { key: "p03", label: "0.3μm" },
  { key: "p05", label: "0.5μm" },
  { key: "p5", label: "5.0μm" },
];

export const ISO_CLASSES = ["ISO 5", "ISO 6", "ISO 7", "ISO 8"];

export const ROOMS: Room[] = [
  { id: "CR-1201", label: "CR-1201 · 光刻准备间", isoClass: "ISO 5" },
  { id: "CR-2107", label: "CR-2107 · 刻蚀间", isoClass: "ISO 6" },
  { id: "CR-2305", label: "CR-2305 · 薄膜沉积间", isoClass: "ISO 7" },
  { id: "Y-0302", label: "Y-0302 · 黄光区", isoClass: "ISO 6" },
  { id: "CR-3402", label: "CR-3402 · 封装测试间", isoClass: "ISO 8" },
];

export function roomById(id: string): Room | undefined {
  return ROOMS.find((room) => room.id === id);
}

export function channelLabel(key: Channel): string {
  return CHANNELS.find((c) => c.key === key)?.label ?? key;
}

/**
 * ISO 14644-1:2015 各等级空气粒子浓度上限（粒/m³），
 * 作为首个发布版本的初始限值。
 */
const BASE_LIMITS: Record<string, ParticleLimits> = {
  "ISO 5": { p03: 10200, p05: 3520, p5: 29 },
  "ISO 6": { p03: 102000, p05: 35200, p5: 293 },
  "ISO 7": { p03: 1020000, p05: 352000, p5: 2930 },
  "ISO 8": { p03: 10200000, p05: 3520000, p5: 29300 },
};

export function cloneLimits(
  source: Record<string, ParticleLimits>
): Record<string, ParticleLimits> {
  return JSON.parse(JSON.stringify(source)) as Record<string, ParticleLimits>;
}

export function baseLimits(): Record<string, ParticleLimits> {
  return cloneLimits(BASE_LIMITS);
}

/** 按给定限值判定实测计数，返回越界通道与总体结论 */
export function judge(
  counts: Record<Channel, number>,
  limits: ParticleLimits
): { exceeded: Channel[]; verdict: Verdict } {
  const exceeded = CHANNELS.filter((c) => counts[c.key] > limits[c.key]).map(
    (c) => c.key
  );
  return { exceeded, verdict: exceeded.length > 0 ? "abnormal" : "normal" };
}

/** 仅接受非负整数；空串或非法返回 null */
export function parseCount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function fmtNum(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function shortId(id: string): string {
  return id.length > 10 ? id.slice(-6).toUpperCase() : id;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
