import { useState } from "react";
import { CHANNELS, type InspectionRecord, type LimitVersion } from "../types";
import { classLabel, channelText, formatCount, formatDateTime } from "../domain";

interface RecordCardProps {
  record: InspectionRecord;
  version?: LimitVersion;
  original?: InspectionRecord;
  correction?: InspectionRecord;
  canCorrect?: boolean;
  onCorrect?: (record: InspectionRecord) => void;
  canHandle?: boolean;
  onHandle?: (record: InspectionRecord, note: string) => void;
}

export function RecordCard({
  record,
  version,
  original,
  correction,
  canCorrect,
  onCorrect,
  canHandle,
  onHandle,
}: RecordCardProps) {
  const [note, setNote] = useState("");
  const abnormal = record.status === "abnormal";
  const versionMissing = record.versionId && !version;

  return (
    <article className={`record-card-v2 ${abnormal ? "is-abnormal" : ""} ${record.kind === "correction" ? "is-correction" : ""}`}>
      <header className="rc-head">
        <div className="rc-id">
          <span className="rc-code">{record.id}</span>
          {record.kind === "correction" ? (
            <span className="badge badge-correction">修正补录</span>
          ) : (
            <span className="badge badge-routine">常规巡检</span>
          )}
          {abnormal ? (
            <span className="badge badge-abnormal">超限异常</span>
          ) : (
            <span className="badge badge-normal">合格</span>
          )}
          {abnormal && record.handled && <span className="badge badge-handled">已处理</span>}
        </div>
        <div className="rc-time">采样 {formatDateTime(record.sampledAt)}</div>
      </header>

      <div className="rc-meta">
        <span><b>{record.roomId}</b> {record.roomName}</span>
        <span>{classLabel(record.classId)}</span>
        <span>巡检员：{record.inspector}</span>
        <span className={versionMissing ? "version-missing" : ""}>
          判定版本：<b>{record.versionCode}</b>
          {version?.status === "published" &&
            version.publishedAt != null &&
            `（发布于 ${formatDateTime(version.publishedAt)}）`}
          {versionMissing && " ⚠ 版本缺失"}
        </span>
      </div>

      {record.kind === "correction" && (
        <div className="rc-reason">
          <span className="reason-tag">修正原因</span>
          {record.reason || "（未填写）"}
          {record.correctsId && <em> · 修正自 {record.correctsId}</em>}
          {original && <em>（原采样 {formatDateTime(original.sampledAt)}，结论：{original.status === "abnormal" ? "超限" : "合格"}）</em>}
        </div>
      )}

      <div className="rc-counts">
        {CHANNELS.map((ch) => {
          const hit = record.violations.find((v) => v.channel === ch);
          const limit = record.limitsSnapshot[ch];
          return (
            <div key={ch} className={`count-cell ${hit ? "cell-over" : ""}`}>
              <span className="count-channel">{channelText(ch)}</span>
              <strong className="count-value">{formatCount(record.counts[ch])}</strong>
              <span className="count-limit">
                上限 {formatCount(limit)}
              </span>
              {hit && (
                <span className="over-flag">
                  ⚠ 越界 {formatCount(hit.value)} / {formatCount(hit.limit)}（超 {formatCount(hit.value - hit.limit)}）
                </span>
              )}
            </div>
          );
        })}
        <div className={`conclusion-cell ${abnormal ? "conclusion-bad" : "conclusion-good"}`}>
          <span>判定结论</span>
          <strong>{abnormal ? `${record.violations.length} 项超限` : "全部合格"}</strong>
          <small>依据记录内限值快照</small>
        </div>
      </div>

      {abnormal && record.handled && record.handleNote && (
        <div className="rc-handled-note">处理备注：{record.handleNote}</div>
      )}

      {correction && (
        <div className="rc-linked">
          已有修正补录 {correction.id}（{formatDateTime(correction.sampledAt)}）：
          {correction.status === "abnormal"
            ? `复测仍超限 ${correction.violations.length} 项`
            : "复测合格"}
          {correction.reason ? ` —— ${correction.reason}` : ""}
        </div>
      )}

      <footer className="rc-actions">
        {canCorrect &&
          onCorrect &&
          record.kind === "routine" &&
          !correction &&
          (version?.status === "published" || record.versionId) && (
            <button className="btn-secondary" onClick={() => onCorrect(record)}>
              补录修正
            </button>
          )}
        {canCorrect && correction && <span className="action-hint">该记录已完成修正补录</span>}
        {canHandle && onHandle && abnormal && !record.handled && (
          <div className="handle-row">
            <input
              placeholder="处理措施 / 备注（必填后才能标记处理）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={!note.trim()}
              onClick={() => {
                onHandle(record, note);
                setNote("");
              }}
            >
              标记已处理
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
