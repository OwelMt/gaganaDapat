import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";
import ReliefRequestForm from "./ReliefRequestForm";
jest.mock("react-router-dom", () => { const navigate = jest.fn(); const location = { search: "" }; return { useNavigate: () => navigate, useLocation: () => location }; }, { virtual: true });
jest.mock("../layout/DashboardShell", () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));
jest.mock("xlsx", () => ({ read: jest.fn(), utils: { sheet_to_json: jest.fn() } }));
beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => {
    if (url.includes("debug-session")) return { role: "barangay" };
    if (url.includes("barangays/me")) return { _id: "b1", barangayName: "Test" };
    if (url.includes("bootstrap")) return { rows: [{ evacuationCenterName: "Hall", male: 0, female: 0 }] };
    if (url.includes("journey/current")) return { stage: "preparation" };
    return [];
  }}));
  XLSX.read.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
});
test("zero is a placeholder and Individuals excludes overlapping counts", async () => {
  render(<ReliefRequestForm />);
  fireEvent.click(await screen.findByRole("button", { name: "Prepare New Request" }));
  const male = await screen.findByRole("spinbutton", { name: "Hall Male" });
  expect(male).toHaveValue(null);
  expect(male).toHaveAttribute("placeholder", "0");
  fireEvent.change(male, { target: { value: "40" } });
  expect(male).toHaveValue(40);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Hall Female" }), { target: { value: "40" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Hall Senior" }), { target: { value: "20" } });
  expect(screen.getByLabelText("Hall Individuals")).toHaveTextContent("80");
  fireEvent.change(male, { target: { value: "" } });
  expect(male).toHaveValue(null);
});
test("invalid Excel opens a correction modal without replacing current rows", async () => {
  const { container } = render(<ReliefRequestForm />);
  fireEvent.click(await screen.findByRole("button", { name: "Prepare New Request" }));
  const male = await screen.findByRole("spinbutton", { name: "Hall Male" });
  fireEvent.change(male, { target: { value: "12" } });
  XLSX.utils.sheet_to_json.mockReturnValue([{ "Evacuation Center": "Hall", Male: 40, Female: 40, Individuals: 89 }]);
  const file = new File(["sheet"], "counts.xlsx");
  file.arrayBuffer = async () => new ArrayBuffer(8);
  fireEvent.change(container.querySelector('input[accept=".xlsx,.xls,.csv"]'), { target: { files: [file] } });
  expect(await screen.findByRole("dialog")).toHaveTextContent("Individuals must equal Male + Female (80)");
  expect(male).toHaveValue(12);

  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});


test("valid Excel updates rows and calculates Individuals with or without a supplied total", async () => {
  const { container } = render(<ReliefRequestForm />);
  fireEvent.click(await screen.findByRole("button", { name: "Prepare New Request" }));
  await screen.findByRole("spinbutton", { name: "Hall Male" });
  for (const total of [undefined, 80]) {
    XLSX.utils.sheet_to_json.mockReturnValue([{ "Evacuation Center": "Hall", Male: 40, Female: 40, Senior: 80, Pregnant: 40, Individuals: total, "Food Packs": 10 }]);
    const file = new File(["sheet"], "valid.xlsx");
    file.arrayBuffer = async () => new ArrayBuffer(8);
    fireEvent.change(container.querySelector('input[accept=".xlsx,.xls,.csv"]'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Hall Male" })).toHaveValue(40));
    expect(screen.getByLabelText("Hall Individuals")).toHaveTextContent("80");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
});
