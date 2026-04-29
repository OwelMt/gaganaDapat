import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  FaBed,
  FaBell,
  FaBuilding,
  FaClipboardList,
  FaHistory,
  FaListUl,
  FaSignOutAlt,
  FaSun,
  FaMoon,
} from "react-icons/fa";

import logo from "../../assets/images/sagipbayanlogo.png";

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const getNotificationCount = async (moduleName) => {
  const res = await fetch(
    `${BASE_URL}/api/notifications?limit=100&module=${moduleName}&status=unread`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!res.ok) return 0;

  const data = await res.json();
  const items = Array.isArray(data.notifications) ? data.notifications : [];

  return items.length;
};

export default function Sidebar({
  collapsed,
  onToggle,
  onLogout,
  onNavigateMobile,
  username,
  roleLabel,
}) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const navScrollRef = useRef(null);
  const SIDEBAR_SCROLL_KEY = "sidebar:admin:scrollTop";
  const PAGE_SCROLL_KEY = "sidebar:admin:pageScrollY";

  const [unreadCount, setUnreadCount] = useState(0);
  const [inventoryUnreadCount, setInventoryUnreadCount] = useState(0);
  const [evacUnreadCount, setEvacUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCounts = async () => {
      try {
        const [allRes, inventoryCount, evacuationCount] = await Promise.all([
          fetch(`${BASE_URL}/api/notifications/unread-count`, {
            method: "GET",
            credentials: "include",
          }),
          getNotificationCount("inventory"),
          getNotificationCount("evacuation"),
        ]);

        if (allRes.ok) {
          const allData = await allRes.json();

          if (isMounted) {
            setUnreadCount(Number(allData.unreadCount || 0));
          }
        }

        if (isMounted) {
          setInventoryUnreadCount(Number(inventoryCount || 0));
          setEvacUnreadCount(Number(evacuationCount || 0));
        }
      } catch (err) {
        if (isMounted) {
          setUnreadCount(0);
          setInventoryUnreadCount(0);
          setEvacUnreadCount(0);
        }
      }
    };

    fetchUnreadCounts();

    const interval = setInterval(fetchUnreadCounts, 10000);

    const handleFocus = () => {
      fetchUnreadCounts();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    const saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
    if (navScrollRef.current && Number.isFinite(saved)) {
      navScrollRef.current.scrollTop = saved;
    }
  }, []);

  useEffect(() => {
    const savedPageY = Number(sessionStorage.getItem(PAGE_SCROLL_KEY));
    if (!Number.isFinite(savedPageY)) return;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedPageY, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  const handleSidebarNavigate = useCallback(() => {
    if (navScrollRef.current) {
      sessionStorage.setItem(
        SIDEBAR_SCROLL_KEY,
        String(navScrollRef.current.scrollTop || 0)
      );
    }
    sessionStorage.setItem(PAGE_SCROLL_KEY, String(window.scrollY || 0));
    onNavigateMobile?.();
  }, [onNavigateMobile]);

  const links = [
    {
      section: "Overview",
      items: [
        {
          to: "/admin/analytics",
          label: "Analytics",
          Icon: FaListUl,
          exact: true,
          badge: 0,
        },
      ],
    },
    {
      section: "Management",
      items: [
        {
          to: "/admin/accounts",
          label: "Account Management",
          Icon: FaBuilding,
          exact: true,
          badge: 0,
        },
        {
          to: "/evacuation",
          label: "Evacuation Centers",
          Icon: FaBed,
          exact: true,
          badge: evacUnreadCount,
        },
      ],
    },
    {
      section: "Inventory",
      items: [
        {
          to: "/admin/inventory",
          label: "Inventory",
          Icon: FaClipboardList,
          exact: true,
          badge: inventoryUnreadCount,
        },
      ],
    },
    {
      section: "Operations",
      items: [
        {
          to: "/admin/time-in-time-out",
          label: "Time In & Time Out",
          Icon: FaHistory,
          exact: true,
          badge: 0,
        },
      ],
    },
  ];

  const utilityLinks = [
    {
      to: "/admin/notifications",
      label: "Notifications",
      Icon: FaBell,
      exact: true,
      badge: unreadCount,
    },
  ];

  const ThemeIcon = dark ? FaSun : FaMoon;
  const themeLabel = dark ? "Light mode" : "Dark mode";

  const renderBadge = (badge, collapsedMode = false) => {
    const count = Number(badge || 0);

    if (count <= 0) return null;

    return (
      <span
        className={
          collapsedMode
            ? "sidebar-badge sidebar-badge-collapsed"
            : "sidebar-badge"
        }
      >
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  return (
    <aside
      className={`sidebar sidebar--admin ${collapsed ? "collapsed" : ""}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <img src={logo} className="sidebar-logo" alt="Sagip Bayan logo" />

        {!collapsed && (
          <div className="sidebar-brand">
            <h1 className="sidebar-title">SAGIP BAYAN</h1>
            <p className="sidebar-subtitle">Admin Panel</p>
          </div>
        )}

        <button
          onClick={onToggle}
          className="toggle-btn"
          aria-label="Collapse or expand sidebar"
          type="button"
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-role-card">
          <div className="sidebar-role-avatar">
            {(username || roleLabel || "U").charAt(0).toUpperCase()}
          </div>

          <div className="sidebar-role-meta">
            <span className="sidebar-role-kicker">Signed in as</span>
            <strong className="sidebar-role-name">
              {username || "Unknown User"}
            </strong>
            <span className="sidebar-role-subtext">{roleLabel}</span>
          </div>
        </div>
      )}

      <nav className="sidebar-nav" role="navigation">
        <div
          className="sidebar-nav-scroll"
          ref={navScrollRef}
          onScroll={() =>
            sessionStorage.setItem(
              SIDEBAR_SCROLL_KEY,
              String(navScrollRef.current?.scrollTop || 0)
            )
          }
        >
          {links.map((group) => (
            <div className="sidebar-group" key={group.section}>
              {!collapsed && (
                <div className="sidebar-group-label">{group.section}</div>
              )}

              {group.items.map((item) => {
                const Icon = item.Icon;
                const badge = Number(item.badge || 0);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={handleSidebarNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      "sidebar-link" + (isActive ? " active" : "")
                    }
                  >
                    <Icon className="sidebar-fa-icon" aria-hidden="true" />

                    {!collapsed && (
                      <>
                        <span className="sidebar-link-label">{item.label}</span>
                        {renderBadge(badge)}
                      </>
                    )}

                    {collapsed && renderBadge(badge, true)}
                  </NavLink>
                );
              })}
            </div>
          ))}

          <div className="sidebar-group sidebar-utility-group">
            {!collapsed && <div className="sidebar-group-label">Updates</div>}

            {utilityLinks.map((item) => {
              const Icon = item.Icon;
              const badge = Number(item.badge || 0);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={handleSidebarNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    "sidebar-link sidebar-link-notification" +
                    (isActive ? " active" : "")
                  }
                >
                  <Icon className="sidebar-fa-icon" aria-hidden="true" />

                  {!collapsed && (
                    <>
                      <span className="sidebar-link-label">{item.label}</span>
                      {renderBadge(badge)}
                    </>
                  )}

                  {collapsed && renderBadge(badge, true)}
                </NavLink>
              );
            })}
          </div>
        </div>

        <div className="sidebar-footer">
          {!collapsed && <div className="sidebar-group-label">Preferences</div>}

          <button
            type="button"
            className="sidebar-link is-button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={themeLabel}
          >
            <ThemeIcon className="sidebar-fa-icon" aria-hidden="true" />

            {!collapsed && (
              <span className="sidebar-link-label">{themeLabel}</span>
            )}
          </button>

          <button
            type="button"
            className="sidebar-link is-button sidebar-link-danger"
            onClick={onLogout}
            title="Log out"
          >
            <FaSignOutAlt className="sidebar-fa-icon" aria-hidden="true" />

            {!collapsed && <span className="sidebar-link-label">Log out</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}
