import {
  MAX_INVENTORY_REFERENCE_LENGTH,
  MAX_TEMPLATE_NAME_LENGTH,
  sanitizeInventoryCompactText,
  sanitizeInventoryNoteText,
  sanitizeInventoryReferenceText,
  sanitizeInventorySearchText,
  sanitizeTemplateDescription,
  sanitizeTemplateName,
} from "./inventoryTextUtils";

describe("inventoryTextUtils", () => {
  test("trims long unbroken compact text tokens", () => {
    expect(
      sanitizeInventoryCompactText(
        "Notocallldasdasdasdasdasdsadsasdasdasdasdasdasdasdsaasd"
      )
    ).toBe("Notocallldasdasdasdasdasdsad");
  });

  test("keeps note text readable while removing unsupported characters", () => {
    expect(
      sanitizeInventoryNoteText("Donation from jp $$$$\nReference...🚫🚫")
    ).toBe("Donation from jp $$\nReference..");
  });

  test("normalizes reference numbers and caps their length", () => {
    const value = sanitizeInventoryReferenceText(" abc-1234 / test ref @@@ ");
    expect(value).toBe("ABC-1234 / TEST REF");
    expect(sanitizeInventoryReferenceText("x".repeat(100))).toHaveLength(
      MAX_INVENTORY_REFERENCE_LENGTH
    );
  });

  test("sanitizes search text and removes noisy symbols", () => {
    expect(sanitizeInventorySearchText("donor ### name %% alert 🚫")).toBe(
      "donor ## name alert"
    );
  });

  test("tightens template name and description limits", () => {
    expect(
      sanitizeTemplateName(
        "Food pack alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi"
      )
    ).toHaveLength(MAX_TEMPLATE_NAME_LENGTH);
    expect(
      sanitizeTemplateDescription("Rice, sardines, and noodles for evacuees!!! ###")
    ).toBe("Rice, sardines, and noodles for evacuees!! ##");
  });
});
