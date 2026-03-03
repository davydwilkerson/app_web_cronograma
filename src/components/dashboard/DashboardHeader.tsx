"use client";

import { useState } from "react";
import { AuthUser } from "@/types/auth";
import styles from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
    user: AuthUser;
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    async function handleLogout() {
        // Redirect to logout API route
        window.location.href = "/api/auth/logout";
    }

    return (
        <header>
            <div className="container">
                <div className="header-surface">
                    <div className="header-inner">
                        {/* Logo */}
                        <a href="/dashboard" className="logo">
                            <span className="logo-text">
                                Cronograma <span>EA</span>
                            </span>
                        </a>

                        {/* Desktop Nav */}
                        <nav className={styles.desktopNav}>
                            <a href="/dashboard" className={styles.navLink}>
                                <i className="fas fa-calendar-alt"></i>
                                <span>Cronograma</span>
                            </a>
                            {(user.role === "admin" || user.role === "superadmin") && (
                                <a href="/admin" className={styles.navLink}>
                                    <i className="fas fa-cog"></i>
                                    <span>Admin</span>
                                </a>
                            )}
                        </nav>

                        {/* User Info */}
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

                            {/* Theme Toggle */}
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => {
                                    const current =
                                        document.documentElement.getAttribute("data-theme");
                                    const next = current === "dark" ? "light" : "dark";
                                    document.documentElement.setAttribute("data-theme", next);
                                    localStorage.setItem("theme", next);
                                }}
                                title="Alternar tema"
                                id="theme-toggle"
                            >
                                <i className="fas fa-moon"></i>
                            </button>

                            {/* Logout */}
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={handleLogout}
                                title="Sair"
                                id="logout-btn"
                            >
                                <i className="fas fa-sign-out-alt"></i>
                            </button>

                            {/* Mobile Menu Toggle */}
                            <button
                                type="button"
                                className={`${styles.menuBtn} icon-btn`}
                                onClick={() => setMenuOpen(!menuOpen)}
                                aria-label="Menu"
                                id="mobile-menu-toggle"
                            >
                                <i className={`fas ${menuOpen ? "fa-times" : "fa-bars"}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Mobile Nav */}
                    {menuOpen && (
                        <nav className={styles.mobileNav}>
                            <a
                                href="/dashboard"
                                className={styles.mobileNavLink}
                                onClick={() => setMenuOpen(false)}
                            >
                                <i className="fas fa-calendar-alt"></i>
                                Cronograma
                            </a>
                            {(user.role === "admin" || user.role === "superadmin") && (
                                <a
                                    href="/admin"
                                    className={styles.mobileNavLink}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    <i className="fas fa-cog"></i>
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
