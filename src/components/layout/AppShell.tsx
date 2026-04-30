import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity, BarChart3, CalendarDays, HeartPulse, LayoutDashboard, MonitorPlay, Settings } from "lucide-react";
import clsx from "clsx";
import { text, useLanguage, type Language } from "../../data/i18n";
import { useGolfLog } from "../../data/store";

const navItems = [
  { to: "/", label: { ko: "대시보드", en: "Dashboard" }, icon: LayoutDashboard },
  { to: "/distance", label: { ko: "비거리", en: "Distance" }, icon: BarChart3 },
  { to: "/screen-golf", label: { ko: "스크린골프", en: "Screen Golf" }, icon: MonitorPlay },
  { to: "/swing-ai", label: { ko: "스윙 AI", en: "Swing AI" }, icon: Activity },
  { to: "/health", label: { ko: "건강", en: "Health" }, icon: HeartPulse },
  { to: "/calendar", label: { ko: "캘린더", en: "Calendar" }, icon: CalendarDays },
  { to: "/settings", label: { ko: "설정", en: "Settings" }, icon: Settings },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { data, serverError } = useGolfLog();
  const { language, setLanguage } = useLanguage();
  const initials = data.profile.name.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/">
          <span aria-hidden="true" />
          {text(language, "스윙.로그", "Swing Log")}
        </NavLink>
        <nav className="primary-nav" aria-label={text(language, "주요 메뉴", "Primary navigation")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) => clsx("nav-item", isActive && "active")}
                end={item.to === "/"}
                key={item.to}
                to={item.to}
              >
                <Icon size={16} />
                {item.label[language]}
              </NavLink>
            );
          })}
        </nav>
        <div className="topbar-actions">
          <div className="user-chip" aria-label={text(language, "현재 사용자와 단위", "Current user and units")}>
            <span>
              {data.profile.distanceUnit} · {data.profile.weightUnit}
            </span>
            <b>{initials}</b>
          </div>
          <div className="language-toggle" role="group" aria-label={text(language, "언어 선택", "Language")}>
            {(["ko", "en"] as Language[]).map((option) => (
              <button className={language === option ? "active" : ""} key={option} onClick={() => setLanguage(option)} type="button">
                {option === "ko" ? "KR" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </header>
      {serverError === "sync_failed" ? (
        <div className="sync-warning">{text(language, "변경사항을 저장하지 못했습니다. 연결 상태를 확인해주세요.", "Could not save changes. Check the connection.")}</div>
      ) : null}
      <main>{children}</main>
    </div>
  );
}
