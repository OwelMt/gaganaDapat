import { render, screen } from "@testing-library/react";
import AdminUserManual from "./AdminUserManual";

jest.mock(
  "react-router-dom",
  () => ({
    __esModule: true,
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="dashboard-shell">{children}</div>,
}));

describe("AdminUserManual", () => {
  test("details the Admin operational buttons and links to their tools", () => {
    render(<AdminUserManual />);

    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Administrator User Manual" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open relief requests/i })).toHaveAttribute(
      "href",
      "/admin/relief-lists"
    );
    expect(screen.getByText("Open Release Planner")).toBeInTheDocument();
    expect(screen.getByText("Mark Received")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account Management" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evacuation Centers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Announcements" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guidelines" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Time In & Time Out" })).toBeInTheDocument();
    expect(screen.queryByText("QUICK START")).not.toBeInTheDocument();
  });
});
