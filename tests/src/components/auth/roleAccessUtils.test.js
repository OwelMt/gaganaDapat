import {
  ANALYTICS_TAB_DONATIONS,
  ANALYTICS_TAB_EVACUATION,
  ANALYTICS_TAB_INCIDENTS,
  ANALYTICS_TAB_INVENTORY,
  ANALYTICS_TAB_OVERVIEW,
  ANALYTICS_TAB_RELIEF,
  canAccessAnalyticsTab,
  canEditInventoryType,
  canChangeInventoryItemType,
  canViewInventoryType,
  getAnalyticsPageTitle,
  getAnalyticsTabsForRole,
  getDashboardVariantForRole,
  getDonationQueueOwnerLabel,
  getDonationQueueTypeForRole,
  getHomePathForRole,
  getInventoryAddTypes,
  getInventoryEditableTypes,
  getInventoryViewTypes,
  getReliefBasePathForRole,
  getReliefReviewerLabel,
  getSidebarPanelLabel,
} from "./roleAccessUtils";

describe("roleAccessUtils", () => {
  it("maps accountant to its own home path and dashboard variant", () => {
    expect(getHomePathForRole("accountant")).toBe("/accountant/dashboard");
    expect(getDashboardVariantForRole("accountant")).toBe("accountant");
  });

  it("limits accountant analytics tabs to overview, inventory, donations, and relief", () => {
    expect(getAnalyticsTabsForRole("accountant")).toEqual([
      { key: ANALYTICS_TAB_OVERVIEW, label: "Overview" },
      { key: ANALYTICS_TAB_INVENTORY, label: "Inventory" },
      { key: ANALYTICS_TAB_DONATIONS, label: "Donations" },
      { key: ANALYTICS_TAB_RELIEF, label: "Relief Requests" },
    ]);
    expect(canAccessAnalyticsTab("accountant", ANALYTICS_TAB_INCIDENTS)).toBe(false);
    expect(canAccessAnalyticsTab("accountant", ANALYTICS_TAB_EVACUATION)).toBe(false);
    expect(getAnalyticsPageTitle("accountant")).toBe("Accountant Analytics");
  });

  it("limits inventory view access by role while keeping accountant edit access monetary-only", () => {
    expect(getInventoryViewTypes("admin")).toEqual([
      "goods",
      "appliance",
      "monetary",
    ]);
    expect(getInventoryViewTypes("drrmo")).toEqual([
      "goods",
      "appliance",
    ]);
    expect(getInventoryViewTypes("accountant")).toEqual([
      "monetary",
    ]);
    expect(getInventoryAddTypes("accountant")).toEqual(["monetary"]);
    expect(getInventoryEditableTypes("admin")).toEqual([
      "goods",
      "appliance",
      "monetary",
    ]);
    expect(getInventoryEditableTypes("accountant")).toEqual(["monetary"]);
    expect(canViewInventoryType("admin", "goods")).toBe(true);
    expect(canViewInventoryType("drrmo", "goods")).toBe(true);
    expect(canViewInventoryType("drrmo", "monetary")).toBe(false);
    expect(canViewInventoryType("accountant", "goods")).toBe(false);
    expect(canViewInventoryType("accountant", "appliance")).toBe(false);
    expect(canViewInventoryType("accountant", "monetary")).toBe(true);
    expect(canEditInventoryType("admin", "goods")).toBe(true);
    expect(canEditInventoryType("admin", "appliance")).toBe(true);
    expect(canEditInventoryType("admin", "monetary")).toBe(true);
    expect(canEditInventoryType("accountant", "monetary")).toBe(true);
    expect(canEditInventoryType("accountant", "goods")).toBe(false);
  });

  it("does not allow inventory item type changes during edit for any role", () => {
    expect(canChangeInventoryItemType("admin")).toBe(false);
    expect(canChangeInventoryItemType("drrmo")).toBe(false);
    expect(canChangeInventoryItemType("accountant")).toBe(false);
  });

  it("treats accountant like the monetary queue owner for donation and relief flows", () => {
    expect(getDonationQueueTypeForRole("accountant")).toBe("monetary");
    expect(getDonationQueueOwnerLabel("accountant")).toBe("Accountant");
    expect(getReliefBasePathForRole("accountant")).toBe("/accountant");
    expect(getReliefReviewerLabel("accountant")).toBe("Accountant");
  });

  it("uses the correct sidebar panel label for accountant accounts", () => {
    expect(getSidebarPanelLabel("accountant")).toBe("Accountant Panel");
    expect(getSidebarPanelLabel("admin")).toBe("Admin Panel");
  });
});
