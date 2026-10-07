import { render, screen } from "@testing-library/react";
import AccountantUserManual from "./AccountantUserManual";

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

describe("AccountantUserManual", () => {
  test("shows only monetary operations for the Accountant role", () => {
    render(<AccountantUserManual />);

    expect(screen.getByRole("heading", { name: "Accountant User Manual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monetary Relief Requests" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open monetary inventory" })).toHaveAttribute(
      "href",
      "/accountant/inventory"
    );
    expect(screen.queryByRole("heading", { name: "Digital Twin" })).not.toBeInTheDocument();
    expect(screen.queryByText("Food Pack Templates")).not.toBeInTheDocument();
  });
});
