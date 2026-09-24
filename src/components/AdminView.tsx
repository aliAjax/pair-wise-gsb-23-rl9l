import { useMemo, useState } from "react";
import { CHANNELS, CHANNEL_LABEL, ISO_CLASSES, type DraftMatrix, type LimitVersion } from "../types";
import { formatDateTime } from "../domain";
import type { Store } from "../store";
import { LimitTable } from "./LimitTable";

interface AdminViewProps {
  store: Store;
}

function blankDraft(version: LimitVersion): DraftMatrix {
  const m = {} as DraftMatrix;
  ISO_CLASSES.forEach((cls) => {
    m[cls.id] = {
      "0.3": version.limits[cls.id]["0.3"] === null ? "" : String(version.limits[cls.id]["0.3"]),
      "0.5": version.limits[cls.id]["0.5"] === null ? "" : String(version.limits[cls.id]["0.5"]),
      "5.0": version.limits[cls.id]["5.0"] === null ? "" : String(version.limits[cls.id]["5.0"]),
    };
  });
  return m;
}

function validateCell(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null; // 空 = 不设限
  if (!/^\d+$/.test(t)) return "必须是非负整数";
  if (Number(t) > 99_999_999) return "数值过大";
  return null;
}

function DraftEditor({
  version,
  store,
  onPublished,
}: {
  version: LimitVersion;
  store: Store;
  onPublished: () => void;
}) {
  const [draft, setDraft] = useState<DraftMatrix>(() => blankDraft(version));
  const [note, setNote] = useState(version.note);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const errors: string[] = [];
  ISO_CLASSES.forEach((cls) =>
    CHANNELS.forEach((ch) => {
      const err = validateCell(draft[cls.id][ch]);
      if (err) errors.push(`${cls.label} ${CHANNEL_LABEL[ch]}：${err}`);
    })
  );
  const noteEmpty = !note.trim();
  const canPublish = errors.length === 0 && !noteEmpty;

  const setCell = (classId: string, ch: string, value: string) => {
    if (/^\d*$/.test(value.trim()) || value.trim() === "") {
      setDraft((prev) => ({
        ...prev,
        [classId]: { ...prev[classId as keyof DraftMatrix], [ch]: value },
      }));
    }
  };

  const save = () => store.updateDraft(version.id, { note, limits: draft });
  const publish = () => {
    if (!canPublish) return;
    save();
    store.publishDraft(version.id);
    setConfirmPublish(false);
    onPublished();
  };

  return (
    <div className="draft-editor">
      <div className="editor-note">
        <label>
          <span>版本说明（发布必填，说明本次调整原因）</span>
          <textarea
            rows={2}
            value={note}
            placeholder="例如：收紧 ISO 5 的 0.5μm 上限……"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      <div className="editor-table">
        <table>
          <thead>
            <tr>
              <th>ISO 等级</th>
              {CHANNELS.map((ch) => (
                <th key={ch}>{CHANNEL_LABEL[ch]} 上限（粒/m³）</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ISO_CLASSES.map((cls) => (
              <tr key={cls.id}>
                <td className="cell-class">{cls.label}</td>
                {CHANNELS.map((ch) => {
                  const err = validateCell(draft[cls.id][ch]);
                  return (
                    <td key={ch}>
                      <input
                        className={err ? "input-error" : ""}
                        inputMode="numeric"
                        placeholder="不设限"
                        value={draft[cls.id][ch]}
                        onChange={(e) => setCell(cls.id, ch, e.target.value)}
                      />
                      {err && <small className="cell-error">{err}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && <p className="form-error">存在 {errors.length} 个无效单元格，草稿可以保存但不能发布。</p>}

      <div className="editor-actions">
        <button
          className="btn-secondary"
          onClick={save}
          disabled={errors.length > 0}
          title="保存后仍为草稿，不参与巡检判定"
        >
          保存草稿
        </button>
        <button className="btn-danger" onClick={() => store.discardDraft(version.id)}>
          放弃草稿
        </button>
        {!confirmPublish ? (
          <button className="btn-primary" disabled={!canPublish} onClick={() => setConfirmPublish(true)}>
            发布版本
          </button>
        ) : (
          <div className="confirm-publish">
            <span>发布后立即成为巡检默认版本，旧记录不受影响。确认发布 {version.code}？</span>
            <button className="btn-primary" onClick={publish}>
              确认发布
            </button>
            <button className="btn-secondary" onClick={() => setConfirmPublish(false)}>
              再检查一下
            </button>
          </div>
        )}
      </div>
      {noteEmpty && <p className="form-hint">发布前需填写版本说明。</p>}
    </div>
  );
}

export function AdminView({ store }: AdminViewProps) {
  const sortedVersions = useMemo(
    () =>
      [...store.versions].sort(
        (a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt)
      ),
    [store.versions]
  );
  const drafts = store.versions.filter((v) => v.status === "draft");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => sortedVersions[0]?.id ?? null
  );
  const selected = store.versions.find((v) => v.id === selectedId) ?? sortedVersions[0];

  const referencing = selected
    ? store.records.filter((r) => r.versionId === selected.id)
    : [];

  return (
    <div className="admin-layout">
      <aside className="version-list">
        <div className="version-list-head">
          <h2>限值版本</h2>
          <button
            className="btn-primary btn-sm"
            disabled={drafts.length > 0}
            onClick={() => {
              const id = store.createDraft();
              if (id) setSelectedId(id);
            }}
            title={drafts.length > 0 ? "当前已有草稿，发布或放弃后才能新建" : "基于最新版本创建草稿"}
          >
            + 新建草稿
          </button>
        </div>
        <p className="list-hint">草稿不会出现在巡检员的生效版本中</p>

        {sortedVersions.map((v) => {
          const count = store.records.filter((r) => r.versionId === v.id).length;
          return (
            <button
              key={v.id}
              className={`version-item ${selected?.id === v.id ? "active" : ""}`}
              onClick={() => setSelectedId(v.id)}
            >
              <div className="version-item-top">
                <b>{v.code}</b>
                {v.status === "draft" ? (
                  <span className="badge badge-draft">草稿</span>
                ) : (
                  <span className="badge badge-published">已发布</span>
                )}
              </div>
              <div className="version-item-time">
                {v.status === "published" && v.publishedAt != null
                  ? `发布于 ${formatDateTime(v.publishedAt)}`
                  : `创建于 ${formatDateTime(v.createdAt)}`}
              </div>
              <div className="version-item-count">{count} 条记录按此版本判定</div>
            </button>
          );
        })}
      </aside>

      <section className="version-detail panel">
        {!selected ? (
          <div className="empty-box">
            <p>还没有任何限值版本。</p>
            <button className="btn-primary" onClick={() => store.createDraft()}>
              创建第一版草稿
            </button>
          </div>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <h2>
                  {selected.code}
                  {selected.status === "draft" ? "（草稿）" : "（已发布）"}
                </h2>
                <p className="detail-note">{selected.note || "（无版本说明）"}</p>
              </div>
              <div className="detail-time">
                {selected.status === "published"
                  ? `生效起始 ${selected.publishedAt ? formatDateTime(selected.publishedAt) : "-"}`
                  : `草稿创建 ${formatDateTime(selected.createdAt)}`}
              </div>
            </div>

            {selected.status === "draft" ? (
              <DraftEditor
                key={selected.id}
                version={selected}
                store={store}
                onPublished={() => setSelectedId(selected.id)}
              />
            ) : (
              <>
                <div className="detail-locked">
                  <span className="lock-tag">已冻结</span>
                  已发布版本只读；调整限值请基于最新版本新建草稿并发布为新版本，历史记录保留原限值与结论。
                </div>
                <LimitTable matrix={selected.limits} />
                <div className="version-records">
                  <h3>按 {selected.code} 判定的记录（{referencing.length}）</h3>
                  {referencing.length === 0 ? (
                    <p className="form-hint">暂无巡检记录引用此版本。</p>
                  ) : (
                    <ul className="ref-list">
                      {referencing.map((r) => (
                        <li key={r.id}>
                          <b>{r.id}</b> · {r.roomId} · 采样 {formatDateTime(r.sampledAt)} ·{" "}
                          {r.kind === "correction" ? "修正补录" : "常规巡检"} ·{" "}
                          <span className={r.status === "abnormal" ? "text-bad" : "text-good"}>
                            {r.status === "abnormal"
                              ? `超限 ${r.violations.length} 项`
                              : "合格"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
