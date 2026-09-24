import { useEffect, useMemo, useState } from "react";
import { CHANNELS, CHANNEL_LABEL, type InspectionRecord } from "../types";
import {
  classLabel,
  evaluate,
  formatDateTime,
  latestPublished,
  parseCount,
  parseLocalInputValue,
  publishedVersions,
  toLocalInputValue,
} from "../domain";
import type { Store } from "../store";
import { RecordCard } from "./RecordCard";
import { LimitChips, LimitTable } from "./LimitTable";

type Tab = "entry" | "abnormal" | "ledger";

type SubmitNotice =
  | { kind: "ok"; text: string; recordId: string; abnormal: boolean }
  | { kind: "error"; text: string };

export function InspectorView({ store }: { store: Store }) {
  const [tab, setTab] = useState<Tab>("entry");
  const [notice, setNotice] = useState<SubmitNotice | null>(null);
  const [correctTarget, setCorrectTarget] = useState<InspectionRecord | null>(null);

  const published = useMemo(() => publishedVersions(store.versions), [store.versions]);

  /* ---- 录入表单状态 ---- */
  const [roomId, setRoomId] = useState(store.rooms[0]?.id ?? "");
  const [versionId, setVersionId] = useState(latestPublished(store.versions)?.id ?? "");
  const [inspector, setInspector] = useState("");
  const [sampledAt, setSampledAt] = useState(toLocalInputValue(Date.now()));
  const [countInputs, setCountInputs] = useState<Record<string, string>>({
    "0.3": "",
    "0.5": "",
    "5.0": "",
  });
  const [reason, setReason] = useState("");

  // 生效版本被发布/变化后，保证选中项仍是已发布版本
  useEffect(() => {
    if (!published.some((v) => v.id === versionId)) {
      setVersionId(latestPublished(store.versions)?.id ?? "");
    }
  }, [published, versionId, store.versions]);

  const startCorrection = (record: InspectionRecord) => {
    setCorrectTarget(record);
    setCountInputs({ "0.3": "", "0.5": "", "5.0": "" });
    setReason("");
    setSampledAt(toLocalInputValue(Date.now()));
    setNotice(null);
    setTab("entry");
  };

  const exitCorrection = () => {
    setCorrectTarget(null);
    setReason("");
    setCountInputs({ "0.3": "", "0.5": "", "5.0": "" });
  };

  const selectedRoom = store.rooms.find((r) => r.id === roomId);
  const effectiveClassId = correctTarget?.classId ?? selectedRoom?.classId;
  const effectiveVersion = correctTarget
    ? store.getVersion(correctTarget.versionId)
    : published.find((v) => v.id === versionId);

  const parsedCounts = useMemo(
    () => ({
      "0.3": parseCount(countInputs["0.3"]),
      "0.5": parseCount(countInputs["0.5"]),
      "5.0": parseCount(countInputs["5.0"]),
    }),
    [countInputs]
  );
  const allCountsValid = CHANNELS.every((ch) => parsedCounts[ch] !== null);
  const countsFilled = CHANNELS.every((ch) => countInputs[ch].trim() !== "");
  const countsReady = allCountsValid && countsFilled;

  const previewViolations = useMemo(() => {
    if (!effectiveClassId || !effectiveVersion || !countsReady) return [];
    return evaluate(
      {
        "0.3": parsedCounts["0.3"]!,
        "0.5": parsedCounts["0.5"]!,
        "5.0": parsedCounts["5.0"]!,
      },
      effectiveVersion.limits[effectiveClassId]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveClassId, effectiveVersion, countsReady, countInputs]);

  const sampledTs = parseLocalInputValue(sampledAt);

  const canSubmit =
    (correctTarget || !!selectedRoom) &&
    !!effectiveVersion &&
    effectiveVersion.status === "published" &&
    inspector.trim() !== "" &&
    sampledTs !== null &&
    allCountsValid &&
    CHANNELS.every((ch) => countInputs[ch].trim() !== "") &&
    (!correctTarget || reason.trim() !== "");

  const submit = () => {
    if (!canSubmit) return;
    if (!sampledTs) return;
    const counts = {
      "0.3": parsedCounts["0.3"]!,
      "0.5": parsedCounts["0.5"]!,
      "5.0": parsedCounts["5.0"]!,
    };
    if (correctTarget) {
      const id = store.addCorrection({
        correctsId: correctTarget.id,
        sampledAt: sampledTs,
        inspector,
        counts,
        reason,
      });
      if (!id) {
        setNotice({ kind: "error", text: "提交失败：原记录或其判定版本不可用。" });
        return;
      }
      const willAbnormal =
        evaluate(counts, effectiveVersion!.limits[correctTarget.classId]).length > 0;
      setNotice({
        kind: "ok",
        text: `修正记录 ${id} 已创建，原记录 ${correctTarget.id} 保持不变。`,
        recordId: id,
        abnormal: willAbnormal,
      });
      exitCorrection();
      setTab(willAbnormal ? "abnormal" : "ledger");
      return;
    }
    if (!selectedRoom) return;
    const id = store.addRoutine({
      roomId: selectedRoom.id,
      versionId: effectiveVersion!.id,
      sampledAt: sampledTs,
      inspector,
      counts,
    });
    if (!id) {
      setNotice({ kind: "error", text: "提交失败：请选择已发布的生效版本。草稿不能用于判定。" });
      return;
    }
    const abnormal = previewViolations.length > 0;
    setNotice({
      kind: "ok",
      text: abnormal
        ? `记录 ${id} 已提交：${previewViolations.length} 项越界，已进入异常区。`
        : `记录 ${id} 已提交：三通道全部合格。`,
      recordId: id,
      abnormal,
    });
    setCountInputs({ "0.3": "", "0.5": "", "5.0": "" });
    setTab(abnormal ? "abnormal" : "ledger");
  };

  /* ---- 台账 / 异常区 ---- */
  const sortedRecords = useMemo(
    () => [...store.records].sort((a, b) => b.sampledAt - a.sampledAt),
    [store.records]
  );
  const correctionByOriginal = useMemo(() => {
    const map = new Map<string, InspectionRecord>();
    store.records.forEach((r) => {
      if (r.kind === "correction" && r.correctsId) map.set(r.correctsId, r);
    });
    return map;
  }, [store.records]);

  const abnormalRecords = sortedRecords.filter((r) => r.status === "abnormal");
  const openAbnormal = abnormalRecords.filter((r) => !r.handled);
  const [abnormalFilter, setAbnormalFilter] = useState<"open" | "handled" | "all">("open");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "normal" | "abnormal">("all");

  const visibleAbnormal = abnormalRecords.filter((r) =>
    abnormalFilter === "all" ? true : abnormalFilter === "open" ? !r.handled : r.handled
  );
  const visibleLedger = sortedRecords.filter((r) =>
    ledgerFilter === "all" ? true : r.status === ledgerFilter
  );

  return (
    <div className="inspector-view">
      <div className="inspector-rulebar">
        {published.length > 0 ? (
          <>
            当前生效：<b>{published[0].code}</b>
            {published[0].publishedAt != null && ` · 发布于 ${formatDateTime(published[0].publishedAt)}`}
            <span className="rulebar-note">草稿不显示、不参与判定；旧记录按各自快照版本回溯</span>
          </>
        ) : (
          <span className="text-bad">尚无已发布版本，请先由管理员发布限值版本后再录入。</span>
        )}
      </div>

      <nav className="inspector-tabs">
        <button className={tab === "entry" ? "active" : ""} onClick={() => setTab("entry")}>
          录入判定
        </button>
        <button className={tab === "abnormal" ? "active" : ""} onClick={() => setTab("abnormal")}>
          异常区
          <span className="tab-count">{openAbnormal.length}</span>
        </button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => setTab("ledger")}>
          巡检台账
          <span className="tab-count tab-count-muted">{store.records.length}</span>
        </button>
      </nav>

      {notice && (
        <div className={`notice ${notice.kind === "ok" ? "notice-ok" : "notice-error"}`}>
          {notice.text}
          {notice.kind === "ok" && (
            <button className="btn-link" onClick={() => setNotice(null)}>
              知道了
            </button>
          )}
        </div>
      )}

      {tab === "entry" && (
        <section className="entry-layout">
          <div className="panel entry-form">
            {correctTarget && (
              <div className="correction-banner">
                <div>
                  <b>修正补录模式</b>
                  <p>
                    正在为原记录 {correctTarget.id}（{correctTarget.roomId}，
                    {classLabel(correctTarget.classId)}）补录。房间与判定版本
                    {correctTarget.versionCode} 已锁定，原记录不会被覆盖，必须填写修正原因。
                  </p>
                </div>
                <button className="btn-secondary" onClick={exitCorrection}>
                  退出修正
                </button>
              </div>
            )}

            <div className="form-grid">
              <label>
                <span>房间</span>
                {correctTarget ? (
                  <input value={`${correctTarget.roomId} ${correctTarget.roomName}`} disabled />
                ) : (
                  <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                    {store.rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {r.name}（{classLabel(r.classId)} · {r.zone}）
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label>
                <span>生效判定版本</span>
                {correctTarget ? (
                  <input value={`${correctTarget.versionCode}（与原记录一致）`} disabled />
                ) : (
                  <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                    {published.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code}
                        {v.publishedAt != null ? ` · ${formatDateTime(v.publishedAt)} 发布` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label>
                <span>巡检员</span>
                <input
                  value={inspector}
                  placeholder="姓名"
                  onChange={(e) => setInspector(e.target.value)}
                />
              </label>

              <label>
                <span>采样时间</span>
                <input
                  type="datetime-local"
                  value={sampledAt}
                  onChange={(e) => setSampledAt(e.target.value)}
                />
              </label>
            </div>

            <div className="count-form">
              <h3>粒子计数（粒/m³）</h3>
              <div className="count-inputs">
                {CHANNELS.map((ch) => {
                  const invalid = parsedCounts[ch] === null;
                  const hit = previewViolations.find((v) => v.channel === ch);
                  return (
                    <label key={ch} className={`count-label ${hit ? "count-label-over" : ""}`}>
                      <span>
                        {CHANNEL_LABEL[ch]}
                        {effectiveClassId && effectiveVersion && (
                          <em className="inline-limit">
                            上限 {effectiveVersion.limits[effectiveClassId][ch] === null
                              ? "不设限"
                              : (effectiveVersion.limits[effectiveClassId][ch] as number).toLocaleString("zh-CN")}
                          </em>
                        )}
                      </span>
                      <input
                        inputMode="numeric"
                        placeholder="填写计数"
                        value={countInputs[ch]}
                        className={invalid && countInputs[ch].trim() !== "" ? "input-error" : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*$/.test(v.trim()))
                            setCountInputs((prev) => ({ ...prev, [ch]: v }));
                        }}
                      />
                      {hit && <small className="over-inline">越界：{hit.value.toLocaleString("zh-CN")} &gt; {hit.limit.toLocaleString("zh-CN")}</small>}
                    </label>
                  );
                })}
              </div>
            </div>

            {correctTarget && (
              <label className="reason-field">
                <span>修正原因（必填）</span>
                <textarea
                  rows={2}
                  value={reason}
                  placeholder="例如：更换高效过滤器后复测；原计数抄录有误，以本次为准……"
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}

            <div className="entry-footer">
              <div className={`live-verdict ${previewViolations.length ? "verdict-bad" : "verdict-good"}`}>
                {!effectiveClassId || !effectiveVersion
                  ? "选择房间和生效版本后预览判定"
                  : !countsReady
                    ? "计数填写不完整，暂不判定"
                    : previewViolations.length
                      ? `实时预览：${previewViolations.length} 项越界，提交后进入异常区`
                      : "实时预览：未越界，提交后结论为合格"}
              </div>
              <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
                {correctTarget ? "提交修正补录" : "提交巡检记录"}
              </button>
            </div>
          </div>

          <aside className="panel entry-side">
            <h3>
              本房间适用限值
              {effectiveClassId && <span className="side-class">{classLabel(effectiveClassId)}</span>}
            </h3>
            {effectiveVersion ? (
              <>
                <p className="side-version">
                  {effectiveVersion.code}
                  {effectiveVersion.publishedAt != null && ` · ${formatDateTime(effectiveVersion.publishedAt)} 发布`}
                </p>
                {effectiveClassId && <LimitChips limits={effectiveVersion.limits[effectiveClassId]} />}
                <LimitTable matrix={effectiveVersion.limits} highlightClassId={effectiveClassId} size="compact" />
                <p className="form-hint">判定时会把该版本限值复制进记录，之后发布新版本也不会改变本条结论。</p>
              </>
            ) : (
              <p className="form-hint">没有可用于判定的已发布版本。</p>
            )}
          </aside>
        </section>
      )}

      {tab === "abnormal" && (
        <section className="record-stack">
          <div className="filter-bar">
            {(["open", "handled", "all"] as const).map((f) => (
              <button
                key={f}
                className={abnormalFilter === f ? "active" : ""}
                onClick={() => setAbnormalFilter(f)}
              >
                {f === "open" ? `未处理（${openAbnormal.length}）` : f === "handled" ? "已处理" : "全部"}
              </button>
            ))}
          </div>
          {visibleAbnormal.length === 0 ? (
            <div className="empty-box">没有匹配的异常记录。</div>
          ) : (
            visibleAbnormal.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                version={store.getVersion(r.versionId)}
                original={r.correctsId ? store.records.find((o) => o.id === r.correctsId) : undefined}
                correction={correctionByOriginal.get(r.id)}
                canCorrect
                onCorrect={startCorrection}
                canHandle
                onHandle={(rec, n) => store.markHandled(rec.id, n)}
              />
            ))
          )}
        </section>
      )}

      {tab === "ledger" && (
        <section className="record-stack">
          <div className="filter-bar">
            {(["all", "abnormal", "normal"] as const).map((f) => (
              <button
                key={f}
                className={ledgerFilter === f ? "active" : ""}
                onClick={() => setLedgerFilter(f)}
              >
                {f === "all" ? `全部（${store.records.length}）` : f === "abnormal" ? "超限异常" : "合格"}
              </button>
            ))}
          </div>
          {visibleLedger.length === 0 ? (
            <div className="empty-box">暂无巡检记录。</div>
          ) : (
            visibleLedger.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                version={store.getVersion(r.versionId)}
                original={r.correctsId ? store.records.find((o) => o.id === r.correctsId) : undefined}
                correction={correctionByOriginal.get(r.id)}
                canCorrect
                onCorrect={startCorrection}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
