// src/components/layout/Sidebar.js
import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

// LOGO
import logo from "../../assets/images/sagipbayanlogo.png";

// ICONS (white for dark mode, green for light mode)
import analyticswhite from "../../assets/images/analyticswhite.png";
import analyticsgreen from "../../assets/images/analyticsgreen.png";
import reliefwhite from "../../assets/images/reliefwhite.png";
import reliefgreen from "../../assets/images/reliefgreen.png";
import registerwhite from "../../assets/images/registerwhite.png";
import registergreen from "../../assets/images/registergreen.png";
import auditwhite from "../../assets/images/auditwhite.png";
import auditgreen from "../../assets/images/auditgreen.png";
import timewhite from "../../assets/images/timewhite.png";
import timegreen from "../../assets/images/timegreen.png";
import messagewhite from "../../assets/images/messagewhite.png";
import messagegreen from "../../assets/images/messagegreen.png";
import evacuationwhite from "../../assets/images/evacuationwhite.png";
import evacuationgreen from "../../assets/images/evacuationgreen.png";
import logoutwhite from "../../assets/images/logoutwhite.png";
import logoutgreen from "../../assets/images/logoutgreen.png";
import sunwhite from "../../assets/images/sunwhite.png";
import nightgreen from "../../assets/images/nightgreen.png";

export default function Sidebar({ collapsed, onToggle, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const useDark = theme === "dark";

  const links = [
    { to: "/admin/dashboard", label: "Analytics", icon: useDark ? analyticswhite : analyticsgreen },

    { to: "/admin/register", label: "Register Account", icon: useDark ? registerwhite : registergreen },
    { to: "/admin/edit-accounts", label: "Edit Accounts", icon: useDark ? registerwhite : registergreen },
    { to: "/admin/archived-accounts", label: "Archived Accounts", icon: useDark ? auditwhite : auditgreen },

    { to: "/admin/audit-trail", label: "Audit Trail", icon: useDark ? auditwhite : auditgreen },
    { to: "/evacuation", label: "Evacuation Center Management", icon: useDark ? evacuationwhite : evacuationgreen },
    { to: "/admin", label: "Incident Reports", icon: useDark ? auditwhite : auditgreen },
    { to: "/admin/time-in-time-out", label: "Time in & Time out", icon: useDark ? timewhite : timegreen },
    { to: "/admin/logs", label: "Admin Logs", icon: useDark ? auditwhite : auditgreen },

    { to: "/admin/relief", label: "Relief Request", icon: useDark ? reliefwhite : reliefgreen },

  ];

  const themeIcon  = useDark ? sunwhite : nightgreen;
  const themeLabel = useDark ? "Light mode" : "Dark mode";
  const logoutIcon = useDark ? logoutwhite : logoutgreen;

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Main navigation">
      {/* Header */}
      <div className="sidebar-header">
        <img src={logo} className="sidebar-logo" alt="App logo" />
        {!collapsed && <h1 className="sidebar-title">SAGIP BAYAN</h1>}
        <button onClick={onToggle} className="toggle-btn" aria-label="Collapse/Expand sidebar">
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Body + Footer (bottom pinned) */}
      <nav className="sidebar-nav">
        <div className="sidebar-group">
          {links.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              <img src={item.icon} className="sidebar-icon" alt="" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <button type="button" className="sidebar-link is-button" onClick={toggleTheme} aria-label="Toggle theme">
            <img src={themeIcon} alt="" className="sidebar-icon" />
            {!collapsed && <span>{themeLabel}</span>}
          </button>

          <button type="button" className="sidebar-link is-button" onClick={onLogout}>
            <img src={logoutIcon} className="sidebar-icon" alt="" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}