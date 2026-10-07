import { render, screen } from "@testing-library/react";
import DrrmoUserManual from "./DrrmoUserManual";

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

describe("DrrmoUserManual", () => {
  test("shows DRRMO operational modules without Admin-only account access", () => {
    render(<DrrmoUserManual />);

    expect(screen.getByRole("heading", { name: "DRRMO User Manual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Digital Twin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Digital Twin" })).toHaveAttribute(
      "href",
      "/drrmo/digital-twin"
    );
    expect(screen.queryByRole("heading", { name: "Account Management" })).not.toBeInTheDocument();
    expect(screen.queryByText("Enter monetary amount")).not.toBeInTheDocument();
  });
});
