# Per-donation import proofs

Approved design: each imported row has an Attach proofs button opening a named modal with exactly one document and one image slot. Keep files on a stable row ID; replacing an import clears its attachments. Save validates every pending row before sending any requests. Partial failures retain remaining rows and their files. No shared batch proofs.

Implementation plan:
- Update integration tests for isolated row attachments, incomplete rows, replacement, reset and retry.
- Add a compact modal and row status using existing styles, with accessible keyboard dismissal/focus.
- Enforce exactly one supported document and image, 15 MB each, in client and server create/update paths; upload transport maximum two new files. Existing records are not deleted.
- Run targeted frontend/backend tests, production build and desktop/mobile layout checks.
