import { useEffect, useMemo, useState } from "react";
import {
  CHANNELS,
  fmtDateTime,
  ISO_CLASSES,
  parseCount,
} from "../domain";
import type { AppState, LimitVersion, ParticleLimits } from "../types";
import LimitsMatrix from "./LimitsMatrix";

type RawMatrix = Record<string, Record<keyof ParticleLimits, string>>;

function toRaw(limits: Record<string, ParticleLimits>): RawMatrix {
  const raw: RawMatrix = {};
  for (const iso of ISO_CLASSES) {
    raw[iso] = {
      p03: String(limits[iso]?.p03 ?? ""),
      p05: String(limits[iso]?.p05 ?? ""),
      p5: String(limits[iso]?.p5 ?? ""),
    };
  }
  return raw;
}

interface Props {
  state: AppState;
  onCreateDraft: (note: string) => void;
  onUpdateLimits: (draftId: string, limits: Record<string, ParticleLimits>) => void;
  onPublish: (draftId: string, note: string) => void;
  onDiscard: (draftId: string) => void;
}

export default function AdminVersions({
  state,
  onCreateDraft,
  onUpdateLimits,
  onPublish,
  onDiscard,
}: Props) {
  const draft = state.versions.find((v) => v.status === "draft");
  const published = state.versions
    .filter((v) => v.status === "published")
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  const [newNote, setNewNote] = useState("");
  const [raw, setRaw] = useState<RawMatrix>(() =>
    draft ? toRaw(draft.limits) : toRaw({})
  );
  const [publishNote, setPublishNote] = useState("");
  const [triedPublish, setTriedPublish] = useState(false);

  // 草稿出现/切换时用其限值初始化编辑框
  useEffect(() => {
    if (draft) setRaw(toRaw(draft.limits));
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPublishNote(draft?.note ?? ""), [draft?.id]);

  const invalidCells = useMemo(() => {
    const cells = new Set<string>();
    if (draft) {
      for (const iso of ISO_CLASSES) {
        for (const c of CHANNELS) {
          const value = parseCount(raw[iso][c.key]);
          if (value === null || value <= 0) cells.add(`${iso}:${c.key}`);
        }
      }
    }
    return cells;
  }, [draft, raw]);

  const publishNoteMissing = publishNote.trim().length === 0;
  const publishBlocked = invalidCells.size > 0 || publishNoteMissing;

  function handleCell(iso: string, channel: keyof ParticleLimits, text: string) {
    if (!draft) return;
    const next: RawMatrix = JSON.parse(JSON.stringify(raw));
    next[iso][channel] = text;
    setRaw(next);

    const value = parseCount(text);
    if (value !== null && value > 0) {
      const numeric = JSON.parse(
        JSON.stringify(draft.limits)
      ) as Record<string, ParticleLimits>;
      numeric[iso][channel] = value;
      onUpdateLimits(draft.id, numeric);
    }
  }

  function handleCreate() {
    onCreateDraft(newNote.trim() || "新版本（草稿未命名）");
    setNewNote("");
  }

  function handlePublish() {
    setTriedPublish(true);
    if (!draft || publishBlocked) return;
    onPublish(draft.id, publishNote.trim());
    setTriedPublish(false);
  }

  function handleDiscard() {
    if (!draft) return;
    if (window.confirm("放弃该草稿？草稿未发布，不影响任何在效版本与历史记录。")) {
      onDiscard(draft.id);
      setTriedPublish(false);
    }
  }

  return (
    <div className="admin-console">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p>限值版本台</p>
            <h2>{draft ? `v${draft.versionNo} 草稿编辑` : "草稿区"}</h2>
          </div>
          <span className="badge badge-draft">草稿不参与判定</span>
        </div>

        {draft ? (
          <>
            <p className="hint">
              草稿从当前生效版本 v
              {published[0]?.versionNo ?? "—"} 复制限值后修改；只有点“发布”，新巡检才会按
              v{draft.versionNo} 判定。
            </p>
            <LimitsMatrix
              limits={draft.limits}
              mode="edit"
              invalidCells={invalidCells}
              onChange={handleCell}
            />
            {triedPublish && invalidCells.size > 0 && (
              <p className="form-error">存在非法上限：必须为大于 0 的整数（标红单元格）。</p>
            )}
            <label className="note-field">
              <span>发布说明（必填）</span>
              <input
                value={publishNote}
                placeholder="例如：ISO 7 收紧 0.5μm 上限以配合新工艺"
                onChange={(e) => setPublishNote(e.target.value)}
              />
            </label>
            {triedPublish && publishNoteMissing && (
              <p className="form-error">发布说明必填，便于追溯每次限值变更原因。</p>
            )}
            <div className="action-row">
              <button className="primary-action" onClick={handlePublish}>
                发布 v{draft.versionNo}
              </button>
              <button onClick={handleDiscard}>放弃草稿</button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">
              当前无草稿。限值只能通过“新版本 + 发布”变更，已发布版本不可修改，历史巡检永远保留其判定时的限值快照。
            </p>
            <label className="note-field">
              <span>新版本说明</span>
              <input
                value={newNote}
                placeholder="例如：光刻区加严，发布 v2"
                onChange={(e) => setNewNote(e.target.value)}
              />
            </label>
            <div className="action-row">
              <button className="primary-action" onClick={handleCreate}>
                新建草稿（复制生效版本限值）
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>发布历史</p>
            <h2>已发布版本（{published.length}）</h2>
          </div>
        </div>
        <div className="version-timeline">
          {published.map((v) => (
            <PublishedCard key={v.id} version={v} isCurrent={v.id === published[0]?.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PublishedCard({ version, isCurrent }: { version: LimitVersion; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`version-card${isCurrent ? " is-current" : ""}`}>
      <button className="version-head" onClick={() => setOpen((o) => !o)}>
        <span className="version-title">
          <strong>v{version.versionNo}</strong>
          {isCurrent && <span className="badge badge-live">当前生效</span>}
          <span className="badge badge-published">已发布 · 冻结</span>
        </span>
        <span className="version-meta">
          {version.publishedAt ? fmtDateTime(version.publishedAt) : "—"} · {open ? "收起" : "查看限值"}
        </span>
      </button>
      <p className="version-note">{version.note}</p>
      {open && <LimitsMatrix limits={version.limits} mode="read" />}
    </article>
  );
}
