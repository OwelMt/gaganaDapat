import { fireEvent, render, screen } from "@testing-library/react";
import ReliefRequestsList from "./ReliefRequestsList";

jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="dashboard-shell">{children}</div>,
}));

describe("ReliefRequestsList", () => {
  beforeEach(() => {
    localStorage.setItem("role", "admin");
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/drrmo/requests/queue")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ requests: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  test("renders without reading accomplished pagination state before initialization", async () => {
    render(<ReliefRequestsList />);

    expect(await screen.findByTestId("dashboard-shell")).toBeInTheDocument();
  });

  test("opens the selected request in a mobile details sheet", async () => {
    const request = {
      _id: "request-mobile-1",
      status: "pending",
      barangayName: "Sample Barangay",
      requestNo: "RR-100",
      disaster: "Flood",
      requestDate: "2026-09-20T00:00:00.000Z",
      submittedAt: "2026-09-20T00:00:00.000Z",
      totals: { requestedFoodPacks: 12 },
      evacuationRows: [],
    };
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/drrmo/requests/queue")) {
        return Promise.resolve({ ok: true, json: async () => ({ requests: [request] }) });
      }
      if (String(url).endsWith(`/api/drrmo/requests/${request._id}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ request }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    window.matchMedia = jest.fn(() => ({ matches: true }));

    render(<ReliefRequestsList />);
    fireEvent.click(await screen.findByRole("button", { name: /Sample Barangay/i }));

    const details = await screen.findByRole("dialog", { name: "Relief request details" });
    expect(details).toHaveTextContent("Sample Barangay");
    expect(screen.getByRole("button", { name: "Back to request queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to request queue" }));
    expect(screen.queryByRole("dialog", { name: "Relief request details" })).not.toBeInTheDocument();
  });

  test("keeps desktop request details in the right panel", async () => {
    const request = {
      _id: "request-desktop-1",
      status: "pending",
      barangayName: "Sample Barangay",
      requestNo: "RR-101",
      disaster: "Flood",
      totals: { requestedFoodPacks: 12 },
      evacuationRows: [],
    };
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/drrmo/requests/queue")) {
        return Promise.resolve({ ok: true, json: async () => ({ requests: [request] }) });
      }
      if (String(url).endsWith(`/api/drrmo/requests/${request._id}`)) {
        return Promise.resolve({ ok: true, json: async () => ({ request }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    window.matchMedia = jest.fn(() => ({ matches: false }));

    render(<ReliefRequestsList />);
    fireEvent.click(await screen.findByRole("button", { name: /Sample Barangay/i }));

    expect(await screen.findByText("Decision Panel")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Relief request details" })).not.toBeInTheDocument();
  });
});
