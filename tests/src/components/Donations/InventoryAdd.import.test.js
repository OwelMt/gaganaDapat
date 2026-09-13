import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import * as XLSX from "xlsx";
import InventoryAdd from "./InventoryAdd";

jest.mock("axios");

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

let mockRole = "accountant";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: mockRole,
    },
  }),
}));

describe("InventoryAdd import flow", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRole = "accountant";
    localStorage.clear();
    window.open = jest.fn();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          asOfDate: "2026-08-14",
          items: {
            goods: [],
            appliance: [],
            monetary: [],
          },
        }),
      })
    );

    axios.get.mockImplementation((url) => {
      if (String(url).includes("/api/inventory/archived")) {
        return Promise.resolve({ data: [] });
      }

      if (String(url).includes("/api/inventory")) {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    axios.post.mockResolvedValue({ data: { _id: "imported-item-1" } });

    XLSX.read.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    });

    XLSX.utils.sheet_to_json.mockReturnValue([
      {
        "Donor Name": "Sample Donor",
        Amount: 1500,
        "Reference Number": "REF-IMPORT-001",
        "Source Type": "External",
        Notes: "Imported from sample workbook",
      },
    ]);
  });


  const upload = async (container) => {
    const file = new File(["sheet"], "donations.xlsx");
    file.arrayBuffer = async () => new ArrayBuffer(8);
    fireEvent.change(container.querySelector('input[accept=".xlsx,.xls,.csv"]'), { target: { files: [file] } });
    await screen.findByRole("table", { name: "Imported donations" });
  };
  const addProofs = () => {
    screen.getAllByRole("button", { name: /^Attach proofs for/ }).forEach((button, index) => {
      fireEvent.click(screen.getAllByRole("button", { name: /^Attach proofs for/ })[index]);
      fireEvent.change(screen.getByLabelText("Document proof"), { target: { files: [new File(["proof"], `receipt-${index}.pdf`, { type: "application/pdf" })] } });
      fireEvent.change(screen.getByLabelText("Image proof"), { target: { files: [new File(["image"], `donation-${index}.png`, { type: "image/png" })] } });
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    });
  };
  const goods = [
    { "Item Name": "Rice", Category: "food", Quantity: 50, Unit: "kg", "Source Name": "Community Donor" },
    { "Item Name": "Blankets", Category: "bedding", Quantity: 20, Unit: "pcs", "Source Name": "Community Donor" }
  ];

  test("previews monetary rows first and saves only after proofs and explicit Save", async () => {
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Monetary Donation/i }));
    await upload(container);
    expect(screen.getByRole("table", { name: "Imported donations" })).toHaveTextContent("Sample Donor");
    expect(axios.post).not.toHaveBeenCalled();
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /Save Monetary/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    const data = axios.post.mock.calls[0][1];
    expect(data.get("referenceNumber")).toBe("REF-IMPORT-001");
    expect(data.getAll("proofFiles")).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole("table", { name: "Imported donations" })).not.toBeInTheDocument());
  });

  test("goods import requires no proofs until Save and saves every previewed row", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);
    expect(screen.getByRole("table", { name: "Imported donations" })).toHaveTextContent("Rice");
    expect(screen.getByRole("table", { name: "Imported donations" })).toHaveTextContent("Blankets");
    expect(axios.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Every donation needs exactly one document and one image/i).length).toBeGreaterThan(0);
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(axios.post.mock.calls.map((call) => call[1].get("name"))).toEqual(["Rice", "Blankets"]);
    expect(axios.post.mock.calls.map((call) => call[1].getAll("proofFiles").map(file => file.name))).toEqual([
      ["receipt-0.pdf", "donation-0.png"], ["receipt-1.pdf", "donation-1.png"]
    ]);
    await waitFor(() => expect(screen.queryByRole("table", { name: "Imported donations" })).not.toBeInTheDocument());
  });

  test("row proof modal uses the inventory modal layout with cancel and styled upload actions", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);

    fireEvent.click(screen.getByRole("button", { name: /^Attach proofs for Rice/ }));

    const dialog = screen.getByRole("dialog", { name: /Upload proofs for Rice/i });
    expect(dialog).toHaveTextContent("Attach the required files for this imported donation row.");
    expect(dialog).toHaveTextContent("Excel row 2");
    expect(screen.getByRole("button", { name: "Close proof upload modal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText("Select document")).toBeInTheDocument();
    expect(screen.getByText("Select image")).toBeInTheDocument();
  });

  test("goods import maps Donated source type labels to the backend external value", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue([
      {
        "Item Name": "Rice",
        Category: "food",
        Quantity: 40,
        Unit: "sacks",
        "Source Type": "Donated",
        "Source Name": "Sample Community Donor",
      },
    ]);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);

    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(axios.post.mock.calls[0][1].get("sourceType")).toBe("external");
    expect(screen.getByRole("table", { name: "Imported donations" })).toHaveTextContent("Donated");
  });

  test("retry after a server failure only saves the remaining rows", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    axios.post.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { data: { message: "Temporary failure" } } }).mockResolvedValue({ data: {} });
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    await screen.findByText(/Temporary failure/);
    expect(screen.getByRole("table", { name: "Imported donations" })).not.toHaveTextContent("Rice");
    expect(screen.getByRole("table", { name: "Imported donations" })).toHaveTextContent("Blankets");
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(3));
    expect(axios.post.mock.calls.map((call) => call[1].get("name"))).toEqual(["Rice", "Blankets", "Blankets"]);
    expect(axios.post.mock.calls[2][1].getAll("proofFiles").map(file => file.name)).toEqual(["receipt-1.pdf", "donation-1.png"]);
  });

  test("Reset clears imported rows without saving", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByRole("table", { name: "Imported donations" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Item Name/i)).toHaveValue("");
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("appliance rows also wait for explicit Save", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue([{ "Appliance Name": "Fan", Category: "electronics", Quantity: 2, Condition: "brand_new" }]);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    fireEvent.click(screen.getByRole("button", { name: "Appliances" }));
    await upload(container);
    expect(axios.post).not.toHaveBeenCalled();
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /Save Appliance/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(axios.post.mock.calls[0][1].get("type")).toBe("appliance");
    expect(axios.post.mock.calls[0][1].get("name")).toBe("Fan");
  });

  test("missing proofs on a later row block the entire batch; replacing the sheet clears proofs", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /^Attach proofs for Blankets/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove image proof" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Every donation needs.*Blankets/)).toBeInTheDocument();
    await upload(container);
    await waitFor(() => expect(screen.getAllByText("0/2 attached")).toHaveLength(2));
  });

  test("row slots reject wrong types and oversized files and replace only the selected slot", async () => {
    mockRole = "drrmo";
    XLSX.utils.sheet_to_json.mockReturnValue(goods);
    const { container } = render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    await upload(container);
    addProofs();
    fireEvent.click(screen.getByRole("button", { name: /^Attach proofs for Rice/ }));
    const input = screen.getByLabelText("Image proof");
    fireEvent.change(input, { target: { files: [new File(["bad"], "wrong.pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one JPG");
    const oversized = new File(["image"], "large.png");
    Object.defineProperty(oversized, "size", { value: 15 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole("alert")).toHaveTextContent("15 MB");
    fireEvent.change(input, { target: { files: [new File(["image"], "replacement.png")] } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Goods/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
    expect(axios.post.mock.calls.map(call => call[1].getAll("proofFiles").map(file => file.name))).toEqual([
      ["receipt-0.pdf", "replacement.png"], ["receipt-1.pdf", "donation-1.png"]
    ]);
  });

  test("manual uploads reject more than one document and one image immediately", async () => {
    mockRole = "drrmo";
    render(<InventoryAdd />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Goods Donation/i }));
    fireEvent.change(screen.getByLabelText("Validation"), { target: { files: [
      new File(["a"], "a.pdf"), new File(["b"], "b.png"), new File(["c"], "c.png")
    ] } });
    expect(screen.getAllByText(/Only one document and one image/).length).toBeGreaterThan(0);
    expect(screen.getByText("No files selected")).toBeInTheDocument();
  });

});
