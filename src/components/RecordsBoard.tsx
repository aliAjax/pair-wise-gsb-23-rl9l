import { useEffect, useMemo, useState } from "react";
import {
  CHANNELS,
  channelLabel,
  fmtDateTime,
  fmtNum,
  roomById,
  shortId,
} from "../domain";
import type { AppState, InspectionRecord } from "../types";

type Tab = "all" | "abnormal" | "normal" | "correction";

interface Props {
  state: AppState;
  currentVersionId?: string;
  highlightId: string | null;
  onClearHighlight: () => void;
  onCorrect: (record: InspectionRecord) => void;
  onJumpOriginal: (record: InspectionRecord) => void;
}

export default function RecordsBoard({
  state,
  currentVersionId,
  highlightId,
  onClearHighlight,
  onCorrect,
  onJumpOriginal,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [roomFilter, setRoomFilter] = useState("");

  const sorted = useMemo(
    () =>
      [...state.records].sort((a, b) => {
        const byTime = b.inspectedAt - a.inspectedAt;
        return byTime !== 0 ? byTime : b.createdAt - a.createdAt;
      }),
    [state.records]
  );

  const counts = useMemo(
    () => ({
      all: sorted.length,
      abnormal: sorted.filter((r) => r.verdict === "abnormal").length,
      normal: sorted.filter((r) => r.verdict === "normal").length,
      correction: sorted.filter((r) => r.kind === "correction").length,
    }),
    [sorted]
  );

  // 跳转目标可能不在当前标签/房间筛选下：高亮期间始终保证目标可见
  useEffect(() => {
    if (!highlightId) return;
    const target = state.records.find((r) => r.id === highlightId);
    if (!target) return;
    setRoomFilter("");
    setTab(
      target.kind === "correction"
        ? "correction"
        : target.verdict === "abnormal"
        ? "abnormal"
        : "normal"
    );
  }, [highlightId, state.records]);

  const shown = sorted.filter((r) => {
    if (r.id === highlightId) return true;
    if (roomFilter && r.roomId !== roomFilter) return false;
    if (tab === "abnormal") return r.verdict === "abnormal";
    if (tab === "normal") return r.verdict === "normal";
    if (tab === "correction") return r.kind === "correction";
    return true;
  });

  const originalById = useMemo(() => {
    const map = new Map<string, InspectionRecord>();
    for (const r of state.records) map.set(r.id, r);
    return map;
  }, [state.records]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "all", label: `全部 ${counts.all}` },
    { key: "abnormal", label: `超限 ${counts.abnormal}` },
    { key: "normal", label: `正常 ${counts.normal}` },
    { key: "correction", label: `修正 ${counts.correction}` },
  ];

  return (
    <section className="panel records-panel">
      <div className="section-heading">
        <div>
          <p>判定台账</p>
          <h2>巡检记录（限值快照随记录冻结）</h2>
        </div>
        <select
          aria-label="按房间筛选"
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
        >
          <option value="">全部房间</option>
          {[...new Set(sorted.map((r) => r.roomId))].map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">该筛选下暂无记录。</p>
      ) : (
        <div className="record-board-list">
          {shown.map((rec) => (
            <RecordCard
              key={rec.id}
              record={rec}
              isJudgedCurrent={rec.versionId === currentVersionId}
              highlighted={rec.id === highlightId}
              original={
                rec.originalRecordId ? originalById.get(rec.originalRecordId) : undefined
              }
              onAckHighlight={onClearHighlight}
              onCorrect={() => onCorrect(rec)}
              onJumpOriginal={() => {
                if (rec.originalRecordId) {
                  const orig = originalById.get(rec.originalRecordId);
                  if (orig) onJumpOriginal(orig);
                }
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface CardProps {
  record: InspectionRecord;
  isJudgedCurrent: boolean;
  highlighted: boolean;
  original?: InspectionRecord;
  onAckHighlight: () => void;
  onCorrect: () => void;
  onJumpOriginal: () => void;
}

function RecordCard({
  record: rec,
  isJudgedCurrent,
  highlighted,
  original,
  onAckHighlight,
  onCorrect,
  onJumpOriginal,
}: CardProps) {
  const room = roomById(rec.roomId);
  return (
    <article
      className={`ledger-card ${rec.verdict === "abnormal" ? "ledger-bad" : "ledger-ok"}${
        rec.kind === "correction" ? " ledger-correction" : ""
      }${highlighted ? " highlighted" : ""}`}
      ref={(el) => {
        if (el && highlighted) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }}
      onClick={highlighted ? onAckHighlight : undefined}
    >
      <header className="ledger-head">
        <div className="ledger-title">
          <strong>{rec.roomId}</strong>
          <span className="ledger-sub">
            {room?.label ?? rec.roomId} · {rec.inspector}
          </span>
        </div>
        <div className="ledger-badges">
          {rec.kind === "correction" && <span className="badge badge-correction">修正记录</span>}
          <span className={`badge ${rec.verdict === "abnormal" ? "badge-danger" : "badge-ok"}`}>
            {rec.verdict === "abnormal" ? "超限" : "正常"}
          </span>
          <span className="badge badge-version">
            按 v{rec.versionNo} 判定
            {isJudgedCurrent ? " · 当时当前版本" : " · 历史版本"}
          </span>
        </div>
      </header>

      <div className="ledger-time">
        巡检时间：{fmtDateTime(rec.inspectedAt)} · 记录建立：{fmtDateTime(rec.createdAt)}
      </div>

      <div className="snapshot-grid">
        {CHANNELS.map((c) => {
          const over = rec.exceeded.includes(c.key);
          return (
            <div key={c.key} className={`snapshot-cell${over ? " over" : ""}`}>
              <span>{c.label}</span>
              <b>{fmtNum(rec.counts[c.key])}</b>
              <em>
                限值 ≤ {fmtNum(rec.limitsSnapshot[c.key])}
                {over ? " · 越界" : ""}
              </em>
            </div>
          );
        })}
      </div>

      {rec.verdict === "abnormal" && (
        <p className="ledger-exceed">
          越界项：
          {rec.exceeded.map((ch) => channelLabel(ch)).join("、")}
        </p>
      )}

      {rec.note && <p className="ledger-note">处理备注：{rec.note}</p>}

      {rec.kind === "correction" && (
        <div className="correction-block">
          <p>
            <b>修正原因：</b>
            {rec.reason}
          </p>
          {original ? (
            <p>
              <b>原记录：</b>
              <button className="link-btn" onClick={onJumpOriginal}>
                {original.roomId} · {fmtDateTime(original.inspectedAt)} · v
                {original.versionNo} · {original.verdict === "abnormal" ? "超限" : "正常"}
              </button>
              （原限值与结论保留不变）
            </p>
          ) : (
            <p className="hint">关联原记录已不存在（{shortId(rec.originalRecordId ?? "")}）。</p>
          )}
        </div>
      )}

      <div className="ledger-actions">
        <button onClick={onCorrect}>补录修正</button>
      </div>
    </article>
  );
}
