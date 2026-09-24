import { useState } from "react";
import "./styles.css";
import { AdminView } from "./components/AdminView";
import { InspectorView } from "./components/InspectorView";
import { loadRole, useStore, type Role } from "./store";

const ROLE_KEY = "cleanroom-limit-console:role";

export default function App() {
  const store = useStore();
  const [role, setRole] = useState<Role>(() => loadRole());
  const [confirmReset, setConfirmReset] = useState(false);

  const switchRole = (next: Role) => {
    setRole(next);
    localStorage.setItem(ROLE_KEY, next);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-title">
          <p className="eyebrow">hxwl-09 · 半导体洁净室</p>
          <h1>限值版本与巡检判定台</h1>
          <p className="subtitle">
            ISO 等级限值按版本发布；每条巡检记录冻结判定时的限值与结论，超限自动进异常区，补录另建修正记录。
          </p>
        </div>
        <div className="header-side">
          <div className="role-switch" role="tablist" aria-label="角色切换">
            <button
              className={role === "admin" ? "active" : ""}
              onClick={() => switchRole("admin")}
            >
              管理员
            </button>
            <button
              className={role === "inspector" ? "active" : ""}
              onClick={() => switchRole("inspector")}
            >
              巡检员
            </button>
          </div>
          <p className="persist-hint">数据保存在本机浏览器，重开页面可继续对账</p>
        </div>
      </header>

      {role === "admin" ? <AdminView store={store} /> : <InspectorView store={store} />}

      <footer className="app-footer">
        <div className="footer-stats">
          <span>已发布版本 {store.versions.filter((v) => v.status === "published").length}</span>
          <span>草稿 {store.versions.filter((v) => v.status === "draft").length}</span>
          <span>巡检记录 {store.records.filter((r) => r.kind === "routine").length}</span>
          <span>修正补录 {store.records.filter((r) => r.kind === "correction").length}</span>
          <span>
            未处理异常 {store.records.filter((r) => r.status === "abnormal" && !r.handled).length}
          </span>
        </div>
        {confirmReset ? (
          <div className="reset-confirm">
            将清空全部版本与记录并恢复演示数据，确定？
            <button className="btn-danger btn-sm" onClick={() => { store.resetAll(); setConfirmReset(false); }}>
              确认重置
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setConfirmReset(false)}>
              取消
            </button>
          </div>
        ) : (
          <button className="btn-link" onClick={() => setConfirmReset(true)}>
            恢复演示数据
          </button>
        )}
      </footer>
    </main>
  );
}
