import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config/api";

const ThemeContext = createContext();

const BASE_URL = API_BASE_URL;

function normalizeTheme(value) {
  return String(value || "").toLowerCase() === "light" ? "light" : "dark";
}

function buildThemeStorageKey(role, userId) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeUserId = String(userId || "").trim();

  if (!safeRole || !safeUserId) {
    return "";
  }

  return `theme:${safeRole}:${safeUserId}`;
}

function isPublicThemeRoute(pathname = "") {
  const normalizedPath = String(pathname || "/").trim().toLowerCase();
  return normalizedPath === "/" || normalizedPath === "/login";
}

function getFallbackIdentity() {
  if (typeof window === "undefined") {
    return { role: "", userId: "" };
  }

  return {
    role: localStorage.getItem("role") || "",
    userId: localStorage.getItem("userId") || ""
  };
}

function getStoredThemeForIdentity(role, userId) {
  if (typeof window === "undefined") return null;

  const cacheKey = buildThemeStorageKey(role, userId);
  if (cacheKey) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return normalizeTheme(cached);
  }

  return null;
}

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const publicThemeRoute = isPublicThemeRoute(location?.pathname);
  const fallbackIdentity = publicThemeRoute
    ? { role: "", userId: "" }
    : getFallbackIdentity();

  const resolvedRole = String(user?.role || fallbackIdentity.role || "").toLowerCase();
  const resolvedUserId = String(user?.userId || fallbackIdentity.userId || "");
  const accountThemeKey = useMemo(
    () => buildThemeStorageKey(resolvedRole, resolvedUserId),
    [resolvedRole, resolvedUserId]
  );

  const [theme, setTheme] = useState(() =>
    getStoredThemeForIdentity(fallbackIdentity.role, fallbackIdentity.userId) || "dark"
  );

  useEffect(() => {
    if (publicThemeRoute) {
      return;
    }

    const nextTheme = user?.themePreference
      ? normalizeTheme(user.themePreference)
      : getStoredThemeForIdentity(resolvedRole, resolvedUserId) || "dark";

    setTheme((current) => (current === nextTheme ? current : nextTheme));
  }, [publicThemeRoute, resolvedRole, resolvedUserId, user?.themePreference]);

  useEffect(() => {
    if (publicThemeRoute) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
      return;
    }

    const normalizedTheme = normalizeTheme(theme);
    document.documentElement.dataset.theme = normalizedTheme;
    localStorage.removeItem("theme");

    if (accountThemeKey) {
      localStorage.setItem(accountThemeKey, normalizedTheme);
    }
  }, [accountThemeKey, publicThemeRoute, theme]);

  const persistThemePreference = async (nextTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);
    setTheme(normalizedTheme);

    if (accountThemeKey) {
      localStorage.setItem(accountThemeKey, normalizedTheme);
    }

    setUser((currentUser) =>
      currentUser ? { ...currentUser, themePreference: normalizedTheme } : currentUser
    );

    try {
      const res = await fetch(`${BASE_URL}/api/auth/theme-preference`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ themePreference: normalizedTheme })
      });

      if (!res.ok) {
        throw new Error(`Theme save failed with status ${res.status}`);
      }

      const data = await res.json();
      const persistedTheme = normalizeTheme(data?.themePreference || normalizedTheme);

      setTheme(persistedTheme);
      if (accountThemeKey) {
        localStorage.setItem(accountThemeKey, persistedTheme);
      }
      setUser((currentUser) =>
        currentUser ? { ...currentUser, themePreference: persistedTheme } : currentUser
      );
    } catch (error) {
      console.error("Theme preference save error:", error);
    }
  };

  const toggleTheme = () =>
    persistThemePreference(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: persistThemePreference,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
