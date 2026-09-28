import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { ThemeProvider, useTheme } from "./ThemeContext";

let mockPathname = "/";

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({ pathname: mockPathname }),
  }),
  { virtual: true }
);

function ThemeProbe({ user }) {
  const { setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [setUser, user]);

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        Toggle theme
      </button>
    </div>
  );
}

function renderThemeRoute(route, user = null) {
  mockPathname = route;

  return render(
    <AuthProvider>
      <ThemeProvider>
        <ThemeProbe user={user} />
      </ThemeProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ themePreference: "light" }),
    })
  );
});

afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

test("public landing route ignores stale account and legacy theme preferences", async () => {
  localStorage.setItem("role", "admin");
  localStorage.setItem("userId", "admin-1");
  localStorage.setItem("theme", "dark");
  localStorage.setItem("theme:admin:admin-1", "dark");
  document.documentElement.dataset.theme = "dark";

  renderThemeRoute("/");

  await waitFor(() => {
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
  expect(localStorage.getItem("theme")).toBeNull();
  expect(localStorage.getItem("theme:admin:admin-1")).toBe("dark");
});

test("login route ignores stale account and legacy theme preferences", async () => {
  localStorage.setItem("role", "admin");
  localStorage.setItem("userId", "admin-1");
  localStorage.setItem("theme", "dark");
  document.documentElement.dataset.theme = "dark";

  renderThemeRoute("/Login");

  await waitFor(() => {
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
  expect(localStorage.getItem("theme")).toBeNull();
});

test("authenticated accounts use separate theme storage keys", async () => {
  localStorage.setItem("theme:admin:admin-1", "dark");
  localStorage.setItem("theme:accountant:acct-1", "light");

  renderThemeRoute("/accountant/dashboard", {
    role: "accountant",
    userId: "acct-1",
    username: "accountant",
  });

  await waitFor(() => {
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  await userEvent.click(screen.getByRole("button", { name: /toggle theme/i }));

  await waitFor(() => {
    expect(localStorage.getItem("theme:accountant:acct-1")).toBe("dark");
  });
  expect(localStorage.getItem("theme:admin:admin-1")).toBe("dark");
  expect(localStorage.getItem("theme")).toBeNull();
});
