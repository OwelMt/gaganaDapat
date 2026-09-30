import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DonationValidationQueue from "./DonationValidationQueue";

jest.mock("../layout/DashboardShell", () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      role: "admin",
    },
  }),
}));

const createJsonResponse = (data) =>
  Promise.resolve({
    ok: true,
    json: async () => data,
  });

describe("DonationValidationQueue", () => {
  const receivedDonation = {
    _id: "donation-1",
    status: "received",
    donorName: "Notocall",
    donationType: "monetary",
    inventoryType: "monetary",
    amount: 5200,
    referenceNumber: "4123512312",
    sourceType: "external",
    fulfillmentMethod: "drop_off",
    createdAt: "2026-05-06T02:15:00.000Z",
    updatedAt: "2026-05-06T02:15:00.000Z",
    photos: [],
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps donation details closed when the active queue is empty", async () => {
    global.fetch = jest.fn((url) => {
      if (
        String(url).includes(
          "/api/donations?limit=300&type=monetary&scope=validation_queue"
        )
      ) {
        return createJsonResponse([receivedDonation]);
      }

      if (String(url).endsWith(`/api/donations/${receivedDonation._id}`)) {
        throw new Error("Details should not load for non-active donations.");
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    render(<DonationValidationQueue />);

    expect(
      await screen.findByText("No active donation records found.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Donation details" })).not.toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining(`/api/donations/${receivedDonation._id}`),
      expect.anything()
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "Donation details" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notocall")).not.toBeInTheDocument();
  });

  it("opens the selected donation details in a dialog from the active queue", async () => {
    const pendingDonation = {
      ...receivedDonation,
      status: "pending",
      donorName: "Sakamotos",
      donorPhone: "9432949600",
      donorEmail: "donor@example.com",
      description: "Please confirm this donation.",
    };
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/donations?limit=300&type=monetary&scope=validation_queue")) {
        return createJsonResponse([pendingDonation]);
      }

      if (String(url).endsWith(`/api/donations/${pendingDonation._id}`)) {
        return createJsonResponse(pendingDonation);
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    window.matchMedia = jest.fn(() => ({ matches: true }));

    render(<DonationValidationQueue />);

    const queueItem = await screen.findByRole("button", { name: /Sakamotos/i });
    expect(screen.queryByRole("dialog", { name: "Donation details" })).not.toBeInTheDocument();

    fireEvent.click(queueItem);

    const detailsDialog = await screen.findByRole("dialog", { name: "Donation details" });
    expect(detailsDialog).toHaveTextContent("Sakamotos");
    expect(detailsDialog).toHaveTextContent("donor@example.com");
    expect(screen.getByRole("button", { name: /Did Not Receive/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark Received/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to donation queue" }));
    expect(screen.queryByRole("dialog", { name: "Donation details" })).not.toBeInTheDocument();
  });

  it("keeps the desktop donation details in the right panel", async () => {
    const pendingDonation = {
      ...receivedDonation,
      status: "pending",
      donorName: "Sakamotos",
    };
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/api/donations?limit=300&type=monetary&scope=validation_queue")) {
        return createJsonResponse([pendingDonation]);
      }

      if (String(url).endsWith(`/api/donations/${pendingDonation._id}`)) {
        return createJsonResponse(pendingDonation);
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    window.matchMedia = jest.fn(() => ({ matches: false }));

    render(<DonationValidationQueue />);
    fireEvent.click(await screen.findByRole("button", { name: /Sakamotos/i }));

    expect(await screen.findByText("Decision Panel")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Donation details" })).not.toBeInTheDocument();
  });
});
