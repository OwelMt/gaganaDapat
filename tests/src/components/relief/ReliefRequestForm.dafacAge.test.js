import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReliefRequestForm from "./ReliefRequestForm";
jest.mock("react-router-dom", () => { const navigate = jest.fn(); const location = { search: "" }; return { useNavigate: () => navigate, useLocation: () => location }; }, { virtual: true });
jest.mock("../layout/DashboardShell", () => ({ __esModule: true, default: ({ children }) => <div>{children}</div> }));

const originalStructuredClone = global.structuredClone;
beforeAll(() => { global.structuredClone = (value) => require("v8").deserialize(require("v8").serialize(value)); });
afterAll(() => { global.structuredClone = originalStructuredClone; });

test("edits and saves family head and member ages, preserving infant zero", async () => {
  const request = { _id: "r1", status: "received", currentStage: "completed", requestType: "foodpacks", supportTypes: ["foodpacks"], rows: [{ evacuationCenterName: "Hall", male: 1, female: 2 }] };
  let record = { _id: "d1", serialNo: "F1", evacuationCenterName: "Hall", distributionDate: new Date().toISOString().slice(0, 10), distributionStatus: "completed", headOfFamily: { surname: "Cruz", firstName: "Ana", age: 35 }, familyMembers: [{ fullName: "Baby Cruz", age: 0 }, { fullName: "Ben Cruz", age: 7 }], distribution: { foodPacksReceived: 1 }, signOff: { familyHeadPrintedName: "Ana Cruz", barangayOfficerPrintedName: "Officer" } };
  let saved;
  global.fetch = jest.fn(async (url, options = {}) => ({ ok: true, json: async () => {
    if (options.method === "PUT") { saved = JSON.parse(options.body); record = { ...record, ...saved }; return { record }; }
    if (url.includes("debug-session")) return { role: "barangay" };
    if (url.includes("barangays/me")) return { _id: "b1", barangayName: "Test" };
    if (url.includes("bootstrap")) return { rows: request.rows };
    if (url.includes("journey/current")) return { request, stage: "completed" };
    if (url.includes("relief-distributions")) return { request, records: [record], caps: { allowsFood: true, foodPacksReceived: 10 } };
    return [];
  }}));
  render(<ReliefRequestForm />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const headAge = screen.getByRole("spinbutton", { name: "Family Head Age" });
  expect(headAge).toHaveValue(35);
  fireEvent.change(headAge, { target: { value: "36" } });
  expect(screen.getByRole("spinbutton", { name: "Family member 1 age" })).toHaveValue(0);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Family member 2 age" }), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Family Record" }));
  await waitFor(() => expect(saved).toBeDefined());
  expect(saved.headOfFamily.age).toBe(36);
  expect(saved.familyMembers.map((member) => member.age)).toEqual([0, 8]);
  expect(await screen.findByText("Baby Cruz - 0 years")).toBeInTheDocument();
  expect(screen.getByText("Ben Cruz - 8 years")).toBeInTheDocument();
});
