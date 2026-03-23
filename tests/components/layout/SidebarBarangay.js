import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

import logo from "../../assets/images/sagipbayanlogo.png";
import reliefwhite from "../../assets/images/reliefwhite.png";
import reliefgreen from "../../assets/images/reliefgreen.png";
import messagewhite from "../../assets/images/messagewhite.png";
import messagegreen from "../../assets/images/messagegreen.png";
import analyticswhite from "../../assets/images/analyticswhite.png";
import analyticsgreen from "../../assets/images/analyticsgreen.png";
import logoutwhite from "../../assets/images/logoutwhite.png";
import logoutgreen from "../../assets/images/logoutgreen.png";
import sunwhite from "../../assets/images/sunwhite.png";
import nightgreen from "../../assets/images/nightgreen.png";

export default function SidebarBarangay({ collapsed, onToggle, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  const links = [
    { to: "/barangay/relief-request",  label: "Relief Request",             icon: dark ? reliefwhite   : reliefgreen },
    { to: "/barangay/messages",        label: "Messages & Announcements",   icon: dark ? messagewhite  : messagegreen },
    { to: "/barangay/relief-status",   label: "Relief Distribution Status", icon: dark ? analyticswhite: analyticsgreen },
  ];

  const themeIcon  = dark ? sunwhite    : nightgreen;
  const themeLabel = dark ? "Light mode": "Dark mode";
  const logoutIcon = dark ? logoutwhite : logoutgreen;

  return (
    <aside className={`sidebar sidebar--barangay ${collapsed ? "collapsed" : ""}`} aria-label="Barangay navigation">
      <div className="sidebar-header">
        <img src={logo} className="sidebar-logo" alt="" />
        {!collapsed && <h1 className="sidebar-title">BARANGAY</h1>}
        <button onClick={onToggle} className="toggle-btn" aria-label="Collapse/Expand sidebar">
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      <nav className="sidebar-nav" role="navigation">
        <div className="sidebar-group">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              <img src={l.icon} className="sidebar-icon" alt="" />
              {!collapsed && <span>{l.label}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-link is-button"
            onClick={toggleTheme}
            title={themeLabel}
          >
            <img src={themeIcon} className="sidebar-icon" alt="" />
            {!collapsed && <span>{themeLabel}</span>}
          </button>

          <button
            type="button"
            className="sidebar-link is-button"
            onClick={onLogout}
            title="Log out"
          >
            <img src={logoutIcon} className="sidebar-icon" alt="" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}