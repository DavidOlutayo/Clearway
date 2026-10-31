# Clearway Build Log

- **31 Oct 2026**: Built Slice 1 (Features F1–F3). Implemented web chat, document intake (1-8 files), extraction with confidence scoring, and cross-document consistency checks.
- **31 Oct 2026**: Fixed Start-case failures: corrected lib/tools import paths, made the model client honour *_PROXY, and show server failure messages in the chat.
- **31 Oct 2026**: Fixed "Case not found." after Start case: case store and pending uploads now persist to .data/ (gitignored) instead of server RAM; Start case surfaces upload errors immediately.
- **31 Oct 2026**: Fixed standard-PDF ingestion: decode text streams with pdf-parse (naive byte scan kept as fallback) and raised model token budgets so reasoning no longer truncates the JSON answer.
- **31 Oct 2026**: Fixed HTML 500 from /process after PDF update: marked pdf-parse external in next.config.mjs so webpack stops bundling its ESM/pdfjs-dist build (module load threw, escaping the route try/catch).
- **31 Oct 2026**: Fixed blank extraction cards: schemas now coerce model number/confidence variants ("12,400", "1200 kg", percents) instead of rejecting the whole extraction; prompt asks for plain JSON numbers.
- **31 Oct 2026**: Fixed key mismatch blanking cards: prompt names the exact 17 field keys; schema maps model aliases (qty/total/invoiceNo/...) to canonical keys and docType aliases (invoice/BL/...) to canonical types.
- **31 Oct 2026**: Multi-document files: extraction returns { documents: [...] } per file and the agent splits each into its own case entry (· part N, cap 5) so cross-checking compares bundled invoice + packing list.
- **31 Oct 2026**: Case status now follows one rule (needs_input iff a Blocking discrepancy is open): resolving the last blocker via button or chat correction flips to ready with a confirmation message.
- **31 Oct 2026**: Tailwind v3 styling pass on the chat UI (same layout/state/flow): bubble shadows, primary buttons with hover grow, severity badges, off-white page.
- **31 Oct 2026**: Enterprise SaaS restyle (same layout/state/flow): slate page, floating white panels, label/value typography in bubbles, semantic badges, dark resolve buttons.
