import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

import logo from "../../assets/images/sagipbayanlogo.png";
import analyticswhite from "../../assets/images/analyticswhite.png";
import analyticsgreen from "../../assets/images/analyticsgreen.png";
import evacuationwhite from "../../assets/images/evacuationwhite.png";
import evacuationgreen from "../../assets/images/evacuationgreen.png";
import logoutwhite from "../../assets/images/logoutwhite.png";
import logoutgreen from "../../assets/images/logoutgreen.png";
import sunwhite from "../../assets/images/sunwhite.png";
import nightgreen from "../../assets/images/nightgreen.png";

export default function SidebarDRRMO({ collapsed, onToggle, onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  // IMPORTANT: All links are under /drrmo/... (no /admin)
  const links = [
    { to: "/drrmo/relief-lists",        label: "Relief Requests List",  icon: dark ? analyticswhite : analyticsgreen },
    { to: "/drrmo/evacuation-centers",  label: "Evacuation Management", icon: dark ? evacuationwhite: evacuationgreen },
    { to: "/drrmo/incidents",           label: "Incident Reports",      icon: dark ? analyticswhite : analyticsgreen },
    { to: "/drrmo/guidelines",          label: "Guidelines",            icon: dark ? analyticswhite : analyticsgreen },
    { to: "/drrmo/audit-trail",         label: "Audit Trail",           icon: dark ? analyticswhite : analyticsgreen },
  ];

  const themeIcon  = dark ? sunwhite : nightgreen;
  const themeLabel = dark ? "Light mode" : "Dark mode";
  const logoutIcon = dark ? logoutwhite : logoutgreen;

  return (
    <aside className={`sidebar sidebar--drrmo ${collapsed ? "collapsed" : ""}`} aria-label="DRRMO navigation">
      <div className="sidebar-header">
        <img src={logo} className="sidebar-logo" alt="" />
        {!collapsed && <h1 className="sidebar-title">DRRMO</h1>}
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