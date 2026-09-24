import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import AdminVersions from "./components/AdminVersions";
import ExceptionZone from "./components/ExceptionZone";
import InspectorConsole, {
  type InspectionInput,
} from "./components/InspectorConsole";
import RecordsBoard from "./components/RecordsBoard";
import { judge, roomById, uid } from "./domain";
import {
  createDraft,
  discardDraft,
  getCurrentVersion,
  getDraft,
  loadInspectorName,
  loadState,
  publishDraft,
  saveInspectorName,
  saveState,
  updateDraftLimits,
} from "./store";
import type { AppState, InspectionRecord } from "./types";

type Role = "inspector" | "admin";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [role, setRole] = useState<Role>("inspector");
  const [inspectorName, setInspectorName] = useState(() => loadInspectorName());
  const [correction, setCorrection] = useState<InspectionRecord | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // 重开页面后状态从 localStorage 恢复；这里保持内存与存储同步
  useEffect(() => saveState(state), [state]);

  const current = getCurrentVersion(state);
  const draft = getDraft(state);
  const publishedCount = state.versions.filter((v) => v.status === "published").length;

  const metrics = useMemo(() => {
    const abnormal = state.records.filter((r) => r.verdict === "abnormal").length;
    return [
      {
        label: "当前生效版本",
        value: current ? `v${current.versionNo}` : "无",
        tone: "ok",
      },
      { label: "异常区记录", value: String(abnormal), tone: abnormal > 0 ? "danger" : "ok" },
      { label: "巡检记录总数", value: String(state.records.length), tone: "accent" },
      { label: "草稿 / 已发布", value: `${draft ? 1 : 0} / ${publishedCount}`, tone: "muted" },
    ];
  }, [state, current, draft, publishedCount]);

  const abnormalRecords = useMemo(
    () =>
      [...state.records]
        .filter((r) => r.verdict === "abnormal")
        .sort((a, b) => b.inspectedAt - a.inspectedAt),
    [state.records]
  );

  function handleInspectorName(name: string) {
    setInspectorName(name);
    saveInspectorName(name);
  }

  function handleSubmit(input: InspectionInput) {
    const room = roomById(input.roomId);
    if (!room) return;
    const targetVersionId = correction ? correction.versionId : input.versionId;
    const version = state.versions.find((v) => v.id === targetVersionId);
    if (!version || version.status !== "published") return;
    const snapshot = version.limits[correction ? correction.isoClass : room.isoClass];
    if (!snapshot) return;

    const { exceeded, verdict } = judge(input.counts, snapshot);
    const now = Date.now();
    const record: InspectionRecord = {
      id: uid("rec"),
      kind: correction ? "correction" : "normal",
      roomId: room.id,
      isoClass: room.isoClass,
      inspector: input.inspector,
      counts: input.counts,
      exceeded,
      verdict,
      versionId: version.id,
      versionNo: version.versionNo,
      limitsSnapshot: { ...snapshot },
      inspectedAt: input.inspectedAt,
      createdAt: now,
      note: input.note,
      ...(correction
        ? { reason: input.reason, originalRecordId: correction.id }
        : {}),
    };
    setState((s) => ({ ...s, records: [record, ...s.records] }));
    if (correction) setCorrection(null);
  }

  function startCorrection(rec: InspectionRecord) {
    setRole("inspector");
    setCorrection(rec);
  }

  function jumpToRecord(rec: InspectionRecord) {
    setHighlightId(rec.id);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-09 · port 5109</p>
          <h1>半导体洁净室巡检</h1>
          <p className="subtitle">
            限值版本与巡检判定台：管理员发布限值版本，巡检按所选生效版本判定；旧记录永久保留判定时的限值快照与结论，补录另建修正记录。
          </p>
          <div className="role-switch" role="tablist" aria-label="角色切换">
            <button
              role="tab"
              aria-selected={role === "inspector"}
              className={role === "inspector" ? "active" : ""}
              onClick={() => {
                setRole("inspector");
                setCorrection(null);
              }}
            >
              巡检员
            </button>
            <button
              role="tab"
              aria-selected={role === "admin"}
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              管理员
            </button>
          </div>
        </div>
        <div className="stack-card">
          <span>追溯原则</span>
          <strong>版本发布即冻结 · 判定限值随记录快照 · 修正不改原单</strong>
          <span>数据保存在本浏览器 localStorage，重开页面版本与记录仍对得上。</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} tone={m.tone} />
        ))}
      </section>

      {role === "admin" ? (
        <AdminVersions
          state={state}
          onCreateDraft={(note) => setState((s) => createDraft(s, note))}
          onUpdateLimits={(draftId, limits) =>
            setState((s) => updateDraftLimits(s, draftId, limits))
          }
          onPublish={(draftId, note) => setState((s) => publishDraft(s, draftId, note))}
          onDiscard={(draftId) => setState((s) => discardDraft(s, draftId))}
        />
      ) : (
        <div className="inspector-layout">
          <InspectorConsole
            key={correction ? `correct-${correction.id}` : "normal"}
            state={state}
            inspectorName={inspectorName}
            onInspectorNameChange={handleInspectorName}
            correction={correction}
            onSubmit={handleSubmit}
            onCancelCorrection={() => setCorrection(null)}
          />
          <ExceptionZone
            records={abnormalRecords}
            onCorrect={startCorrection}
            onGotoRecord={(id) => setHighlightId(id)}
          />
        </div>
      )}

      <RecordsBoard
        state={state}
        currentVersionId={current?.id}
        highlightId={highlightId}
        onClearHighlight={() => setHighlightId(null)}
        onCorrect={startCorrection}
        onJumpOriginal={jumpToRecord}
      />

      <footer className="page-foot">
        所有限值版本、限值快照与巡检记录仅存于本地浏览器；清除站点数据会回到示例状态。
      </footer>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={`tone-${tone}`} />
    </article>
  );
}
