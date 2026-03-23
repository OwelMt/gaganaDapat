// src/components/layout/DashboardShell.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import SidebarAdmin from "./Sidebar";
import SidebarDRRMO from "./SidebarDRRMO";
import SidebarBarangay from "./SidebarBarangay";

import "../css/sidebar.css";
import Confirm from "../common/Confirm";
import SplashScreen from "../splashscreen/SplashScreen";

export default function DashboardShell({ children, variant }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // Pick which sidebar to render (or override with `variant` prop)
  const resolved =
    variant ??
    (pathname.startsWith("/drrmo")
      ? "drrmo"
      : pathname.startsWith("/barangay")
      ? "barangay"
      : "admin");

  const SidebarComp =
    resolved === "drrmo"
      ? SidebarDRRMO
      : resolved === "barangay"
      ? SidebarBarangay
      : SidebarAdmin;

  const requestLogout = () => setConfirmOpen(true);

  const doLogout = async () => {
    setConfirmOpen(false);
    setShowSplash(true);

    try {
      await fetch("http://localhost:8000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } finally {
      localStorage.clear();
      sessionStorage.clear();

      window.setTimeout(() => {
        setShowSplash(false);
        navigate("/Login", { replace: true });
      }, 1200);
    }
  };

  const onToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      document
        .querySelector(".admin-layout")
        ?.classList.toggle("has-collapsed", next);
      return next;
    });
  };

  return (
    <div className="admin-layout">
      {/* Sidebar (fixed width) */}
      <SidebarComp collapsed={collapsed} onToggle={onToggle} onLogout={requestLogout} />

      {/* Main content column (flex) */}
      <main className="admin-main">
        {/* Optional: top header area for page titles/toolbars (non-scrolling) */}
        {/* <header className="admin-header">{...}</header> */}

        {/* Scrolling content area — this is where every page (children) renders */}
        <section className="admin-content">{children}</section>
      </main>

      {/* Confirm dialog */}
      <Confirm
        open={confirmOpen}
        title="Log out"
        message="Are you sure you want to log out?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doLogout}
      />

      {/* Splash overlay during logout */}
      {showSplash && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#fff" }}>
          <SplashScreen />
        </div>
      )}
    </div>
  );
}