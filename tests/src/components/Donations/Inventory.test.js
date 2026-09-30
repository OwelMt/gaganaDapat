import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import Inventory from "./Inventory";

jest.mock("axios");

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: "/inventory",
    state: {},
  }),
}), { virtual: true });

let mockRole = "admin";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: mockRole,
    },
  }),
}));

describe("Inventory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockRole = "admin";
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/inventory/history?")) {
        const requestUrl = new URL(String(url), "http://localhost");
        const requestedAsOf = requestUrl.searchParams.get("asOf") || "2026-07-31";
        return Promise.resolve({
          ok: true,
          json: async () => ({
            asOfDate: requestedAsOf,
            items: {
              goods: [],
              appliance: [],
              monetary: [],
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    axios.get.mockImplementation((url) => {
      if (String(url).includes("/api/inventory/archived")) {
        return Promise.resolve({ data: [] });
      }

      if (String(url).includes("/api/relief-releases/approved-requests")) {
        return Promise.resolve({ data: [] });
      }

      if (String(url).includes("/api/inventory")) {
        return Promise.resolve({
          data: [
            {
              _id: "appliance-1",
              type: "appliance",
              name: "Water Pump",
              quantity: 1,
              addedBy: "DRRMO",
              createdAt: "2026-08-18T09:00:00.000Z",
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  test("renders history controls and disables future inventory months", async () => {
    const { container } = render(<Inventory />);

    expect(await screen.findByText("History")).toBeInTheDocument();
    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();
    expect(historyDateInput).toHaveAttribute("max", "2026-08-23");
  });

  test("returns to live mode when the history date is cleared", async () => {
    const { container } = render(<Inventory />);

    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();

    fireEvent.change(historyDateInput, {
      target: { value: "2026-07-31" },
    });
    expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear history date/i }));
    expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument();
  });

  test("clear filters resets history and returns to the live inventory view", async () => {
    const { container } = render(<Inventory />);

    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();

    fireEvent.change(historyDateInput, {
      target: { value: "2026-07-31" },
    });
    expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear Filters/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument()
    );
  });

  test("explains when the selected history date is before the first available record", async () => {
    const { container } = render(<Inventory />);

    fireEvent.click(await screen.findByRole("button", { name: /Appliances/i }));

    const historyDateInput = container.querySelector(".inventory-history-date");
    expect(historyDateInput).not.toBeNull();

    fireEvent.change(historyDateInput, {
      target: { value: "2026-08-17" },
    });

    await waitFor(() =>
      expect(screen.getByText("No records existed yet.")).toBeInTheDocument()
    );

    expect(
      screen.getByText(
        /No appliance inventory records existed on or before August 17, 2026\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The earliest available appliance record is dated August 18, 2026\./i)
    ).toBeInTheDocument();
  });

  test("does not render the monetary tab for drrmo accounts", async () => {
    mockRole = "drrmo";

    render(<Inventory />);

    expect(await screen.findByRole("button", { name: /Goods/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Appliances/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Monetary/i })).not.toBeInTheDocument();
  });

  test("keeps selected template details inline instead of opening a mobile dialog", async () => {
    mockRole = "drrmo";
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, ...args) => {
      if (String(url).includes("/api/food-pack-templates")) {
        return Promise.resolve({
          data: [
            {
              _id: "template-mobile-1",
              name: "Mobile Test Pack",
              description: "Template detail test",
              items: [
                {
                  inventoryItemId: "goods-1",
                  itemName: "Rice",
                  category: "Food",
                  quantityPerPack: 2,
                  unit: "bags",
                },
              ],
            },
          ],
        });
      }

      return originalGet(url, ...args);
    });
    const { container } = render(<Inventory />);
    fireEvent.click(await screen.findByRole("button", { name: /^Goods$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Release Preparation/i }));
    const templateCard = await screen.findByRole("button", { name: /Mobile Test Pack/i });
    fireEvent.click(templateCard);

    const details = await waitFor(() => {
      const panel = container.querySelector(".template-detail-panel");
      expect(panel).not.toBeNull();
      return panel;
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(details).toHaveTextContent("Rice");
    expect(details).toHaveTextContent("Category");
    expect(details).toHaveTextContent("Per Pack");
    expect(details).toHaveTextContent("Expiration");
    expect(details.querySelector(".table-wrapper")).toBeInTheDocument();
  });

  test("opens the release journey in a mobile dialog when an approved request is tapped", async () => {
    mockRole = "drrmo";
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, ...args) => {
      if (String(url).includes("/api/relief-releases/approved-requests")) {
        return Promise.resolve({
          data: [
            {
              _id: "approved-mobile-1",
              requestNo: "RR-2026-0099",
              requestType: "foodpacks",
              supportTypes: ["foodpacks"],
              barangayName: "Mobile Barangay",
              disaster: "Storm",
              totals: { requestedFoodPacks: 12 },
              fulfillment: { releasedFoodPacks: 0 },
            },
          ],
        });
      }

      return originalGet(url, ...args);
    });
    window.matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(<Inventory />);
    fireEvent.click(await screen.findByRole("button", { name: /Release Preparation/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Open Planner/i }));

    const requestCard = await screen.findByRole("button", { name: /RR-2026-0099/i });
    fireEvent.click(requestCard);

    const dialog = await screen.findByRole("dialog", {
      name: "Release journey for RR-2026-0099",
    });
    expect(dialog).toBeInTheDocument();
    expect(container.querySelector(".release-journey-mobile-dialog")).toBeNull();
    expect(dialog).toHaveTextContent("Release Journey");
    expect(dialog).toHaveTextContent("Mobile Barangay");

    fireEvent.click(screen.getByRole("button", { name: "Back to approved requests" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /RR-2026-0099/i })).toBeInTheDocument();
  });

  test("keeps the release journey in the website layout at desktop widths", async () => {
    mockRole = "drrmo";
    const originalGet = axios.get.getMockImplementation();
    axios.get.mockImplementation((url, ...args) => {
      if (String(url).includes("/api/relief-releases/approved-requests")) {
        return Promise.resolve({
          data: [
            {
              _id: "approved-desktop-1",
              requestNo: "RR-2026-0100",
              requestType: "foodpacks",
              supportTypes: ["foodpacks"],
              barangayName: "Desktop Barangay",
              disaster: "Storm",
              totals: { requestedFoodPacks: 8 },
              fulfillment: { releasedFoodPacks: 0 },
            },
          ],
        });
      }

      return originalGet(url, ...args);
    });
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(<Inventory />);
    fireEvent.click(await screen.findByRole("button", { name: /Release Preparation/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Open Planner/i }));
    fireEvent.click(await screen.findByRole("button", { name: /RR-2026-0100/i }));

    await waitFor(() => {
      expect(container.querySelector(".release-main")).toBeInTheDocument();
    });
    expect(container.querySelector(".release-journey-mobile-dialog")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector(".release-main")).toHaveTextContent("Release Journey");
  });
});
