import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Dashboard from "./Dashboard";

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock(
  "react-router-dom",
  () => ({ useNavigate: () => jest.fn() }),
  { virtual: true }
);

jest.mock("../map/Map", () => () => <div />);

beforeEach(() => {
  localStorage.clear();
  global.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  global.fetch = jest.fn((url, options) => {
    if (String(url).includes("/api/debug-session")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ role: "admin" }),
      });
    }

    if (options?.method === "PUT") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: JSON.parse(options.body) }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ data: null }),
    });
  });
});

function renderDashboard() {
  render(<Dashboard />);
}

async function openInlineEditor() {
  await screen.findByRole("button", { name: /Editor Mode/i });
  fireEvent.click(screen.getByRole("button", { name: /Edit Landing/i }));
}

test("blocks save and shows inline errors for blank preparedness and update fields", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "   " },
  });
  fireEvent.change(screen.getAllByPlaceholderText(/Announcement title/i)[0], {
    target: { value: "" },
  });

  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();
  expect(screen.getByText("Update title is required.")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/api/public-site"),
    expect.objectContaining({ method: "PUT" })
  );
});

test("revalidates hotline detail when the contact type changes", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByLabelText(/Contact Detail/i)[0], {
    target: { value: "0999-000-0000" },
  });
  await waitFor(() => {
    expect(screen.getAllByLabelText(/Contact Detail/i)[0]).toHaveValue(
      "0999-000-0000"
    );
  });
  fireEvent.change(screen.getAllByLabelText(/Type/i)[0], {
    target: { value: "email" },
  });

  expect(
    await screen.findByText("Enter a valid email address.")
  ).toBeInTheDocument();
});

test("clears validation state when reset is used", async () => {
  renderDashboard();

  await openInlineEditor();
  fireEvent.change(screen.getAllByPlaceholderText(/Preparedness reminder/i)[0], {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
  expect(
    await screen.findByText("Preparedness reminder is required.")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

  await waitFor(() => {
    expect(
      screen.queryByText("Preparedness reminder is required.")
    ).not.toBeInTheDocument();
  });
});
