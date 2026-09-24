import { channelLabel, fmtDateTime, fmtNum, roomById } from "../domain";
import type { InspectionRecord } from "../types";

interface Props {
  records: InspectionRecord[];
  onCorrect: (record: InspectionRecord) => void;
  onGotoRecord?: (id: string) => void;
}

export default function ExceptionZone({ records, onCorrect, onGotoRecord }: Props) {
  return (
    <section className="panel exception-panel">
      <div className="section-heading">
        <div>
          <p>异常区</p>
          <h2>超限记录（{records.length}）</h2>
        </div>
        <span className="badge badge-danger">需处理</span>
      </div>

      {records.length === 0 ? (
        <p className="empty">暂无超限记录，提交后若任一通道越界会自动进入这里。</p>
      ) : (
        <div className="exception-list">
          {records.map((rec) => {
            const room = roomById(rec.roomId);
            return (
              <article key={rec.id} className="exception-card">
                <div className="exception-top">
                  <strong>
                    {rec.roomId}
                    {room ? ` · ${room.isoClass}` : ""}
                  </strong>
                  <span className="exception-time">{fmtDateTime(rec.inspectedAt)}</span>
                </div>
                <p className="exception-meta">
                  {rec.inspector} · 按 v{rec.versionNo} 限值判定
                  {rec.kind === "correction" && " · 修正记录"}
                </p>
                <ul className="exceed-list">
                  {rec.exceeded.map((ch) => {
                    const over = rec.counts[ch] - rec.limitsSnapshot[ch];
                    return (
                      <li key={ch}>
                        <span className="exceed-channel">{channelLabel(ch)}</span>
                        <span>
                          实测 <b>{fmtNum(rec.counts[ch])}</b> / 上限{" "}
                          {fmtNum(rec.limitsSnapshot[ch])} · 超出 {fmtNum(over)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {rec.note && <p className="exception-note">备注：{rec.note}</p>}
                <div className="exception-actions">
                  <button onClick={() => onCorrect(rec)}>补录修正</button>
                  {onGotoRecord && (
                    <button className="link-btn" onClick={() => onGotoRecord(rec.id)}>
                      查看完整记录
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
