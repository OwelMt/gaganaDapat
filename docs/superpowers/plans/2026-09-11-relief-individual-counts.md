# Relief individual counts implementation plan

**Goal:** Preserve the current design while calculating Individuals from Male + Female, validating overlapping breakdowns and Excel totals, and displaying empty numeric inputs with zero placeholders.

**Architecture:** Reuse population validation helpers on each side of the API. Validate original spreadsheet cells before coercion and before changing form state. Use the existing account confirmation overlay for actionable import errors. Existing records remain untouched; no migration or deletion.

**Tech stack:** React, SheetJS, Express, Mongoose, Jest, node:test.

- [x] Backend: first update/add node:test cases for overlapping counts, whole nonnegative numbers, pregnancy bounds, subgroup bounds and optional Individuals equality. Implement validation and replace additive population calculations in controllers. Derive Individuals in model totals and existing exports.
- [x] Frontend validation: first test 40 + 40 with supplied 89, valid overlaps, excessive seniors, invalid numbers and missing optional totals. Implement raw-row import validation and accepted Individuals header aliases.
- [x] Forms: preserve existing tables and styles; append calculated Individuals cells, use zero placeholders, validate before state mutation, and show row-specific import errors in the existing account overlay. Apply to request and history editors.
- [x] Consumers: update list/tracking totals and existing tables to use Male + Female. Keep subgroup values visible without adding them to population.
- [x] Verify: run targeted Jest and node:test suites, frontend build, inspect diffs and modal/table behavior. Do not alter unrelated dashboard changes or delete records.


Verification: 46 frontend Jest cases pass across 9 relief suites, plus the four standalone DAFAC checks run with Node. Targeted backend validation and consumer tests pass. Production build succeeds with existing lint warnings. Browser-rendered request table and mobile modal were visually checked using rendered component fixtures; both existing PDF export formats were generated with sample data and visually checked. Existing records were not deleted or migrated. Broader backend run reported one unrelated existing inventory-history test failure.
