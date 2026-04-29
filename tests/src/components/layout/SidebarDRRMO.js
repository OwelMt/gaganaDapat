import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import {
  FaBell,
  FaChartBar,
  FaClipboardList,
  FaComments,
  FaHandHoldingHeart,
  FaHospital,
  FaInfoCircle,
  FaPlusCircle,
  FaSignOutAlt,
  FaSun,
  FaMoon,
} from "react-icons/fa";

import logo from "../../assets/images/sagipbayanlogo.png";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

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

export default function SidebarDRRMO({
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
  const SIDEBAR_SCROLL_KEY = "sidebar:drrmo:scrollTop";
  const PAGE_SCROLL_KEY = "sidebar:drrmo:pageScrollY";

  const [unreadCount, setUnreadCount] = useState(0);
  const [reliefUnreadCount, setReliefUnreadCount] = useState(0);
  const [inventoryUnreadCount, setInventoryUnreadCount] = useState(0);
  const [donationUnreadCount, setDonationUnreadCount] = useState(0);
  const [evacUnreadCount, setEvacUnreadCount] = useState(0);
  const [incidentUnreadCount, setIncidentUnreadCount] = useState(0);
  const [guidelinesUnreadCount, setGuidelinesUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCounts = async () => {
      try {
        const [
          allRes,
          reliefCount,
          inventoryCount,
          donationCount,
          evacuationCount,
          incidentCount,
          guidelinesCount,
        ] = await Promise.all([
          fetch(`${BASE_URL}/api/notifications/unread-count`, {
            method: "GET",
            credentials: "include",
          }),
          getNotificationCount("relief"),
          getNotificationCount("inventory"),
          getNotificationCount("donation"),
          getNotificationCount("evacuation"),
          getNotificationCount("incident"),
          getNotificationCount("guidelines"),
        ]);

        if (allRes.ok) {
          const allData = await allRes.json();

          if (isMounted) {
            setUnreadCount(Number(allData.unreadCount || 0));
          }
        }

        if (isMounted) {
          setReliefUnreadCount(Number(reliefCount || 0));
          setInventoryUnreadCount(Number(inventoryCount || 0));
          setDonationUnreadCount(Number(donationCount || 0));
          setEvacUnreadCount(Number(evacuationCount || 0));
          setIncidentUnreadCount(Number(incidentCount || 0));
          setGuidelinesUnreadCount(Number(guidelinesCount || 0));
        }
      } catch (err) {
        if (isMounted) {
          setUnreadCount(0);
          setReliefUnreadCount(0);
          setInventoryUnreadCount(0);
          setDonationUnreadCount(0);
          setEvacUnreadCount(0);
          setIncidentUnreadCount(0);
          setGuidelinesUnreadCount(0);
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
          to: "/drrmo/analytics",
          label: "Analytics",
          Icon: FaChartBar,
          exact: true,
          badge: 0,
        },
        {
          to: "/",
          label: "Landing Page",
          Icon: FaComments,
          exact: true,
          badge: 0,
        },
      ],
    },
    {
      section: "Relief",
      items: [
        {
          to: "/drrmo/relief-lists",
          label: "Relief Requests",
          Icon: FaHandHoldingHeart,
          exact: true,
          badge: reliefUnreadCount,
        },
        {
          to: "/drrmo/inventory",
          label: "Inventory",
          Icon: FaClipboardList,
          exact: true,
          badge: inventoryUnreadCount,
        },
        {
          to: "/drrmo/inventory/add",
          label: "Add Donations",
          Icon: FaPlusCircle,
          exact: true,
          badge: donationUnreadCount,
        },
      ],
    },
    {
      section: "Monitoring",
      items: [
        {
          to: "/drrmo/evacuation-centers",
          label: "Evacuation Centers",
          Icon: FaHospital,
          exact: true,
          badge: evacUnreadCount,
        },
        {
          to: "/drrmo/incident-report",
          label: "Incident Reports",
          Icon: FaInfoCircle,
          exact: true,
          badge: incidentUnreadCount,
        },
        {
          to: "/drrmo/guidelines",
          label: "Guidelines",
          Icon: FaComments,
          exact: true,
          badge: guidelinesUnreadCount,
        },
      ],
    },
  ];

  const utilityLinks = [
    {
      to: "/drrmo/notifications",
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
      className={`sidebar sidebar--drrmo ${collapsed ? "collapsed" : ""}`}
      aria-label="DRRMO navigation"
    >
      <div className="sidebar-header">
        <img src={logo} className="sidebar-logo" alt="Sagip Bayan logo" />

        {!collapsed && (
          <div className="sidebar-brand">
            <h1 className="sidebar-title">DRRMO</h1>
            <p className="sidebar-subtitle">Operations Panel</p>
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
