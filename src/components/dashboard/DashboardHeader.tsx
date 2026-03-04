"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthUser } from "@/types/auth";
import styles from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
  user: AuthUser;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-theme") === "dark";
  });
  const pathname = usePathname();

  const dashboardActive = useMemo(
    () => pathname === "/dashboard" || pathname.startsWith("/dashboard/semana/"),
    [pathname]
  );
  const adminActive = useMemo(() => pathname.startsWith("/admin"), [pathname]);

  async function handleLogout() {
    window.location.href = "/api/auth/logout";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIsDarkTheme(next === "dark");
  }

  return (
    <header>
      <div className="container">
        <div className="header-surface">
          <div className="header-inner">
            <a href="/dashboard" className="logo">
              <span className="logo-text">
                Cronograma <span>EA</span>
              </span>
            </a>

            <nav className={styles.desktopNav}>
              <a
                href="/dashboard"
                className={`${styles.navLink} ${dashboardActive ? styles.navLinkActive : ""}`}
                aria-current={dashboardActive ? "page" : undefined}
              >
                <i className="fas fa-calendar-alt"></i>
                <span>Cronograma</span>
              </a>

              {(user.role === "admin" || user.role === "superadmin") && (
                <a
                  href="/admin"
                  className={`${styles.navLink} ${adminActive ? styles.navLinkActive : ""}`}
                  aria-current={adminActive ? "page" : undefined}
                >
                  <i className="fas fa-chart-line"></i>
                  <span>Admin</span>
                </a>
              )}
            </nav>

            <div className={styles.userSection}>
              <div className={styles.userInfo}>
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className={styles.avatar}
                  width={36}
                  height={36}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/assets/avatar-nurse-trophy.svg";
                  }}
                />
                <span className={styles.userName}>{user.displayName}</span>
              </div>

              <div className={styles.actionButtons}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={toggleTheme}
                  title="Alternar tema"
                  id="theme-toggle"
                >
                  <i className={`fas ${isDarkTheme ? "fa-sun" : "fa-moon"}`}></i>
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleLogout}
                  title="Sair"
                  id="logout-btn"
                >
                  <i className="fas fa-sign-out-alt"></i>
                </button>

                <button
                  type="button"
                  className={`${styles.menuBtn} icon-btn`}
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="Menu"
                  id="mobile-menu-toggle"
                >
                  <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"}`}></i>
                </button>
              </div>
            </div>
          </div>

          {menuOpen && (
            <nav className={styles.mobileNav}>
              <a
                href="/dashboard"
                className={`${styles.mobileNavLink} ${dashboardActive ? styles.mobileNavLinkActive : ""}`}
                onClick={() => setMenuOpen(false)}
                aria-current={dashboardActive ? "page" : undefined}
              >
                <i className="fas fa-calendar-alt"></i>
                Cronograma
              </a>

              {(user.role === "admin" || user.role === "superadmin") && (
                <a
                  href="/admin"
                  className={`${styles.mobileNavLink} ${adminActive ? styles.mobileNavLinkActive : ""}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={adminActive ? "page" : undefined}
                >
                  <i className="fas fa-chart-line"></i>
                  Admin
                </a>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
