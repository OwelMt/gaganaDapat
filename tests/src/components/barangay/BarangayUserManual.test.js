import { render, screen } from "@testing-library/react";
import BarangayUserManual from "./BarangayUserManual";

jest.mock(
  "react-router-dom",
  () => ({
    __esModule: true,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="dashboard-shell">{children}</div>,
}));

describe("BarangayUserManual", () => {
  test("shows barangay request and tracking tools without staff-only modules", () => {
    render(<BarangayUserManual />);

    expect(screen.getByRole("heading", { name: "Barangay User Manual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Relief Request" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open request status" })).toHaveAttribute(
      "href",
      "/barangay/relief-status"
    );
    expect(screen.queryByRole("heading", { name: "Digital Twin" })).not.toBeInTheDocument();
    expect(screen.queryByText("Food Pack Templates")).not.toBeInTheDocument();
  });
});
