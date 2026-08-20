import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ContactRound,
  Database,
  Home,
  Image,
  Layers3,
  List,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { HealthResponse } from "../lib/api";
import { formatDateTime, profileName } from "../lib/format";
import { Avatar } from "./ui";

const navigation = [
  { to: "/overview", label: "概览", icon: Home },
  { to: "/contacts", label: "联系人", icon: ContactRound },
  { to: "/conversations", label: "会话", icon: MessageCircle },
  { to: "/chat-list", label: "会话列表", icon: List },
  { to: "/contributions", label: "贡献", icon: Layers3 },
  { to: "/media", label: "媒体", icon: Image },
  { to: "/search", label: "搜索", icon: Search },
  { to: "/settings", label: "设置", icon: Settings },
];

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: ({ signal }) => api.health(signal) });
  const healthReady = healthQuery.data?.status === "ok" && healthQuery.data.configured !== false;
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => api.profile(signal),
    enabled: healthReady,
  });
  const isChatList = location.pathname.startsWith("/chat-list");

  if (healthQuery.isPending) {
    return <StartupGate state="loading" />;
  }

  if (healthQuery.isError) {
    return (
      <StartupGate
        state="error"
        error={healthQuery.error}
        isRetrying={healthQuery.isFetching}
        onRetry={() => { void healthQuery.refetch(); }}
      />
    );
  }

  if (!healthReady) {
    return (
      <StartupGate
        state="setup"
        health={healthQuery.data}
        isRetrying={healthQuery.isFetching}
        onRetry={() => { void healthQuery.refetch(); }}
      />
    );
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  const dataQuality = profileQuery.data?.data_quality ?? healthQuery.data.data_quality;
  const snapshot = profileQuery.data?.snapshot_time || dataQuality?.snapshot_time || healthQuery.data.snapshot_time;
  const databaseCount = Number(dataQuality?.decrypted_database_count);
  const integrityCount = Number(dataQuality?.integrity_check_ok);
  const integrityLabel = Number.isFinite(databaseCount) && Number.isFinite(integrityCount)
    ? `${integrityCount}/${databaseCount} 通过`
    : profileQuery.isLoading ? "读取中" : "暂无校验结果";
  const snapshotMode = dataQuality?.snapshot_mode === "base-only" ? "本机主库只读快照" : "本机只读快照";
  const snapshotLabel = snapshot ? "只读快照已载入" : profileQuery.isLoading ? "正在读取快照" : "快照时间未知";

  return (
    <div className={`app-frame${isChatList ? " chat-list-frame" : ""}`}>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate("/overview")} aria-label="返回概览">
          <span className="brand-mark"><MessageCircle size={22} fill="currentColor" /></span>
          <span>微信本地数据库可视化</span>
        </button>
        <div className="topbar-actions">
          <form className="global-search" onSubmit={submitSearch} role="search">
            <input
              aria-label="搜索联系人、会话或内容"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索联系人 / 会话 / 内容"
            />
            <button type="submit" aria-label="开始搜索"><Search size={19} /></button>
          </form>
          <label className="top-filter">
            <CalendarDays size={17} />
            <select aria-label="全局时间范围" value={searchParams.get("range") ?? "all"} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set("range", event.target.value); setSearchParams(next); }}>
              <option value="30">近 30 天</option>
              <option value="90">近 90 天</option>
              <option value="all">全部时间</option>
            </select>
            <ChevronDown size={15} />
          </label>
          <button className="account-button" type="button" onClick={() => navigate("/settings")} aria-label="账号与设置">
            <Avatar profile={profileQuery.data?.profile} size={36} />
            <ChevronDown size={14} />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <Icon size={21} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="source-card" aria-label="数据库快照状态">
          <div className="source-label">数据范围</div>
          <div className="source-value"><Database size={13} fill="currentColor" /> {snapshotMode}</div>
          <div className="source-label source-label-spaced">快照状态</div>
          <div className="source-value" aria-live="polite" title={snapshot ? `快照时间 ${formatDateTime(snapshot)}` : "尚未取得快照时间"}>
            <span className={`status-dot${snapshot ? "" : " pending"}`} /> {snapshotLabel}
          </div>
          <div className="source-divider" />
          <div className="source-label">完整性状态</div>
          <div className="source-value"><span className={`status-dot ${profileQuery.isError || integrityCount < databaseCount ? "bad" : ""}`} /> {integrityLabel}</div>
          <div className="source-label source-label-spaced">快照时间</div>
          <div className="source-value"><RefreshCw size={13} /> {snapshot ? formatDateTime(snapshot) : profileQuery.isLoading ? "读取中" : "暂无快照"}</div>
        </div>
      </aside>

      <main className={`main-content${isChatList ? " chat-list-main" : ""}`}>
        <Outlet context={{ profile: profileQuery.data?.profile, profileResponse: profileQuery.data, profileName: profileName(profileQuery.data?.profile) }} />
      </main>
    </div>
  );
}

type StartupGateProps = {
  state: "loading" | "error" | "setup";
  health?: HealthResponse;
  error?: unknown;
  isRetrying?: boolean;
  onRetry?: () => void;
};

function StartupGate({ state, health, error, isRetrying = false, onRetry }: StartupGateProps) {
  const missing = health?.missing ?? [];
  const errorMessage = error instanceof Error ? error.message : "健康检查请求失败";

  return (
    <main className="startup-shell">
      <section className={`startup-panel ${state}`} aria-live="polite">
        <div className="startup-visual">
          <div className="startup-brand">
            <span className="brand-mark"><MessageCircle size={22} fill="currentColor" /></span>
            <span>微信本地数据库可视化</span>
          </div>
          <div className="startup-visual-copy">
            <span>LOCAL SNAPSHOT</span>
            <strong>解密一次，离线查看。</strong>
            <p>公开、可复现的本地数据流程，不连接微信，不持续监听数据库。</p>
          </div>
          <div className="startup-promise"><Database size={17} /> 只读取配置的解密快照</div>
        </div>

        <div className="startup-content" role={state === "error" ? "alert" : undefined}>
          {state === "loading" && (
            <>
              <span className="startup-kicker">环境检查</span>
              <span className="startup-state-icon loading"><LoaderCircle className="spin" size={27} /></span>
              <h1>正在确认本地数据环境</h1>
              <p>正在连接服务，并检查解密数据库快照是否可以安全读取。</p>
            </>
          )}

          {state === "error" && (
            <>
              <span className="startup-kicker">服务连接</span>
              <span className="startup-state-icon error"><AlertCircle size={27} /></span>
              <h1>无法连接本地服务</h1>
              <p>健康检查失败：{errorMessage}。请确认后端服务已经启动，然后重新检查。</p>
              {onRetry && (
                <button className="green-button startup-retry" type="button" disabled={isRetrying} onClick={onRetry}>
                  <RefreshCw className={isRetrying ? "spin" : ""} size={17} />
                  {isRetrying ? "正在重新检查" : "重新检查服务"}
                </button>
              )}
            </>
          )}

          {state === "setup" && (
            <>
              <span className="startup-kicker">首次运行设置</span>
              <h1>本地数据尚未就绪</h1>
              <p>完成解密并配置快照目录后，可视化面板才会加载个人资料和统计页面。</p>

              <ol className="setup-steps">
                <li><span>1</span><div><strong>解密数据库</strong><p>运行仓库提供的解密流程，生成可读取的本地数据库文件。</p></div></li>
                <li><span>2</span><div><strong>配置快照目录</strong><p>让服务指向解密结果目录，并保留解密报告供完整性检查。</p></div></li>
                <li><span>3</span><div><strong>重新检查</strong><p>配置完成后刷新健康状态，面板会自动进入数据视图。</p></div></li>
              </ol>

              {(health?.database_root || health?.report_path) && (
                <dl className="setup-paths">
                  {health.database_root && <div><dt>数据库目录</dt><dd><code>{health.database_root}</code></dd></div>}
                  {health.report_path && <div><dt>解密报告</dt><dd><code>{health.report_path}</code></dd></div>}
                </dl>
              )}

              {missing.length > 0 && (
                <div className="setup-missing">
                  <strong>仍缺少 {missing.length} 项</strong>
                  {missing.slice(0, 4).map((item, index) => <code key={`${item}-${index}`}>{item}</code>)}
                  {missing.length > 4 && <span>另有 {missing.length - 4} 项等待生成</span>}
                </div>
              )}

              {onRetry && (
                <button className="green-button startup-retry" type="button" disabled={isRetrying} onClick={onRetry}>
                  <RefreshCw className={isRetrying ? "spin" : ""} size={17} />
                  {isRetrying ? "正在检查配置" : "重新检查配置"}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export type ShellContext = {
  profile?: import("../lib/api").Profile;
  profileResponse?: import("../lib/api").ProfileResponse;
  profileName: string;
};
