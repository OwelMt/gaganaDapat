import { fireEvent, render, screen, within } from "@testing-library/react";
import ReliefTracking from "./ReliefTracking";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

test("tracking shows computed individuals after Senior and excludes inactive centers", async () => {
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    json: async () => String(url).includes("debug-session")
      ? { role: "barangay", userId: "user-1" }
      : [{
          _id: "request-1",
          requestNo: "RR-1",
          status: "pending",
          rows: [
            { evacuationCenterName: "Active Center", male: 12, female: 18, lgbtq: 5, pwd: 4, pregnant: 3, senior: 7, individuals: 49 },
            { evacuationCenterName: "Inactive Center", isActiveRow: false, male: 100, female: 100 },
          ],
          totals: { male: 112, female: 118, individuals: 249 },
        }],
  }));
  try {
    render(<ReliefTracking />);
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    const table = screen.getByRole("columnheader", { name: "Individuals" }).closest("table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers.slice(-3)).toEqual(["Senior", "Individuals", "Food Packs"]);
    const dataRow = within(table).getByText("Active Center").closest("tr");
    expect(within(dataRow).getAllByRole("cell")[10]).toHaveTextContent("30");
    expect(within(table.querySelector("tfoot")).getAllByRole("cell")[9]).toHaveTextContent("30");
    expect(within(table).queryByText("Inactive Center")).not.toBeInTheDocument();
  } finally {
    jest.resetAllMocks();
  }
});
