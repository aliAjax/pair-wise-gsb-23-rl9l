import { useMemo, useState } from "react";
import {
  CHANNELS,
  channelLabel,
  fmtDateTime,
  fmtNum,
  judge,
  parseCount,
  roomById,
  ROOMS,
} from "../domain";
import type {
  AppState,
  Channel,
  InspectionRecord,
  LimitVersion,
  ParticleLimits,
} from "../types";

export interface InspectionInput {
  roomId: string;
  versionId: string;
  inspector: string;
  counts: Record<Channel, number>;
  note?: string;
  inspectedAt: number;
  reason?: string;
  originalRecordId?: string;
}

interface Props {
  state: AppState;
  inspectorName: string;
  onInspectorNameChange: (name: string) => void;
  correction: InspectionRecord | null;
  onSubmit: (input: InspectionInput) => void;
  onCancelCorrection: () => void;
}

type RawCounts = Record<Channel, string>;

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export default function InspectorConsole({
  state,
  inspectorName,
  onInspectorNameChange,
  correction,
  onSubmit,
  onCancelCorrection,
}: Props) {
  const published: LimitVersion[] = state.versions
    .filter((v) => v.status === "published")
    .sort((a, b) => (a.publishedAt ?? 0) - (b.publishedAt ?? 0));
  const current = published.at(-1);

  const [roomId, setRoomId] = useState(correction?.roomId ?? ROOMS[0].id);
  const [versionId, setVersionId] = useState(correction?.versionId ?? current?.id ?? "");
  const [raw, setRaw] = useState<RawCounts>(() => ({
    p03: correction ? String(correction.counts.p03) : "",
    p05: correction ? String(correction.counts.p05) : "",
    p5: correction ? String(correction.counts.p5) : "",
  }));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(correction?.note ?? "");
  const [inspectedAt, setInspectedAt] = useState(() =>
    toLocalInputValue(correction?.inspectedAt ?? Date.now())
  );
  const [error, setError] = useState<string | null>(null);
  const [doneTip, setDoneTip] = useState<string | null>(null);

  const room = roomById(roomId);
  const version = published.find((v) => v.id === versionId);
  const limits: ParticleLimits | undefined =
    room && version ? version.limits[room.isoClass] : undefined;

  const parsed: Record<Channel, number | null> = {
    p03: parseCount(raw.p03),
    p05: parseCount(raw.p05),
    p5: parseCount(raw.p5),
  };
  const allFilled = CHANNELS.every((c) => parsed[c.key] !== null);

  const preview = useMemo(() => {
    if (!limits || !allFilled) return null;
    const counts = {
      p03: parsed.p03 as number,
      p05: parsed.p05 as number,
      p5: parsed.p5 as number,
    };
    return { counts, ...judge(counts, limits) };
  }, [limits, allFilled, parsed.p03, parsed.p05, parsed.p5]); // eslint-disable-line react-hooks/exhaustive-deps

  function setCount(channel: Channel, text: string) {
    setRaw((r) => ({ ...r, [channel]: text }));
    setDoneTip(null);
  }

  function resetCounts() {
    setRaw({ p03: "", p05: "", p5: "" });
    setNote("");
    setInspectedAt(toLocalInputValue(Date.now()));
  }

  function handleSubmit() {
    setError(null);
    setDoneTip(null);
    if (!room || !version || !limits) {
      setError("请选择房间与已生效的限值版本。");
      return;
    }
    if (!inspectorName.trim()) {
      setError("请填写巡检员姓名。");
      return;
    }
    if (!allFilled) {
      setError("三个通道计数都必须填写非负整数。");
      return;
    }
    if (correction && !reason.trim()) {
      setError("补录必须填写修正原因。");
      return;
    }
    const ts = new Date(inspectedAt).getTime();
    if (Number.isNaN(ts)) {
      setError("巡检时间不合法。");
      return;
    }
    onSubmit({
      roomId: room.id,
      versionId: version.id,
      inspector: inspectorName.trim(),
      counts: preview!.counts,
      note: note.trim() || undefined,
      inspectedAt: ts,
      ...(correction
        ? { reason: reason.trim(), originalRecordId: correction.id }
        : {}),
    });
    if (correction) return; // 补录提交后父组件切回常规录入
    resetCounts();
    setDoneTip("已提交，结论按所选版本限值判定。");
  }

  return (
    <section className="panel console-panel">
      <div className="section-heading">
        <div>
          <p>巡检判定台</p>
          <h2>{correction ? "补录（修正记录）" : "粒子计数录入"}</h2>
        </div>
        <span className="badge badge-live">
          生效版本 v{current?.versionNo ?? "—"}
        </span>
      </div>

      {correction && (
        <div className="correction-banner">
          <div>
            <strong>正在补录，关联原记录：</strong>
            {correction.roomId} · {fmtDateTime(correction.inspectedAt)} · 按 v
            {correction.versionNo} 判定为
            {correction.verdict === "abnormal" ? "超限" : "正常"}
          </div>
          <p>
            原记录保留不变；本次提交将另建一条“修正记录”，必须填写修正原因，并沿用同一版本限值判定。
          </p>
          <button onClick={onCancelCorrection}>取消补录</button>
        </div>
      )}

      <div className="form-grid">
        <label>
          <span>巡检员</span>
          <input
            value={inspectorName}
            onChange={(e) => onInspectorNameChange(e.target.value)}
            placeholder="姓名"
          />
        </label>
        <label>
          <span>巡检时间</span>
          <input
            type="datetime-local"
            value={inspectedAt}
            onChange={(e) => setInspectedAt(e.target.value)}
          />
        </label>
        <label>
          <span>房间</span>
          <select
            value={roomId}
            disabled={!!correction}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {ROOMS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}（{r.isoClass}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>判定依据版本（仅已发布）</span>
          <select
            value={versionId}
            disabled={!!correction}
            onChange={(e) => setVersionId(e.target.value)}
          >
            {published.length === 0 && <option value="">暂无已发布版本</option>}
            {published.map((v, i) => (
              <option key={v.id} value={v.id}>
                v{v.versionNo}
                {i === published.length - 1 ? "（当前生效）" : "（历史版本）"}
              </option>
            ))}
          </select>
          {correction && (
            <small className="hint">补录锁定原房间与原判定版本 v{correction.versionNo}。</small>
          )}
        </label>
      </div>

      <div className="channel-head">
        <span>通道</span>
        <span>v{version?.versionNo ?? "—"} 上限 · {room?.isoClass ?? "—"}（粒/m³）</span>
        <span>实测计数</span>
        <span>逐项状态</span>
      </div>
      <div className="channel-rows">
        {CHANNELS.map((c) => {
          const limit = limits?.[c.key];
          const value = parsed[c.key];
          const over = limit !== undefined && value !== null && value > limit;
          const ok = limit !== undefined && value !== null && value <= limit;
          return (
            <div key={c.key} className={`channel-row${over ? " is-over" : ""}`}>
              <strong>{c.label}</strong>
              <span className="limit-cell">
                {limit === undefined ? "—" : `≤ ${fmtNum(limit)}`}
              </span>
              <input
                aria-label={`${c.label} 实测计数`}
                inputMode="numeric"
                placeholder="非负整数"
                value={raw[c.key]}
                onChange={(e) => setCount(c.key, e.target.value)}
                className={raw[c.key].trim() !== "" && value === null ? "cell-invalid" : ""}
              />
              <span className={`channel-state ${over ? "state-over" : ok ? "state-ok" : "state-idle"}`}>
                {over
                  ? `超限 +${fmtNum((value as number) - (limit as number))}`
                  : ok
                  ? "未超限"
                  : "待录入"}
              </span>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className={`verdict-banner ${preview.verdict === "abnormal" ? "verdict-bad" : "verdict-ok"}`}>
          {preview.verdict === "abnormal" ? (
            <>
              <strong>判定：超限，进入异常区</strong>
              <span>
                越界项：
                {preview.exceeded.map((ch) => channelLabel(ch)).join("、")}
              </span>
            </>
          ) : (
            <strong>判定：三通道均未超限</strong>
          )}
        </div>
      )}

      <label className="note-field">
        <span>处理备注（选填）</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：已通知厂务复查" />
      </label>

      {correction && (
        <label className="note-field">
          <span>修正原因（必填）</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：原记录 0.5μm 计数录入错误，以本次复测为准"
          />
        </label>
      )}

      {error && <p className="form-error">{error}</p>}
      {doneTip && <p className="form-ok">{doneTip}</p>}

      <div className="action-row">
        <button className="primary-action" onClick={handleSubmit}>
          {correction ? "提交修正记录（不改原记录）" : "提交巡检记录"}
        </button>
      </div>
    </section>
  );
}
