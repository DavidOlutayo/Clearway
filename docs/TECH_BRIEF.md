# Technical Brief for the Coding Agent — Clearance Readiness Copilot Clearway

*Companion to PRD v1.1 · 27 October 2026 · Save in the repo root as AGENTS.md (or the file your coding tool reads)*

## 1. How to work

- The PRD is the source of truth for behaviour. Read it fully first. If this brief and the PRD disagree, the PRD wins; flag it.
- Before writing code, propose a plan: small tasks tied to PRD feature IDs (F1–F10), each with an acceptance check. Wait for the builder’s approval.
- Build thin vertical slices that run end to end. Commit after each slice. Keep a short BUILD\_LOG.md of what was built and when.
- Stay inside the PRD’s Must-have list. Ask when something is ambiguous; do not guess.
- Never hardcode demo results. Everything the demo shows must come from real processing.
- No secrets in the repo; use environment variables and a .env.example.
- The repository is public from the first commit. All work happens inside the build window (27 Oct to 4 Nov). The README states what was built during the hackathon.

## 2. Stack

- One TypeScript repo: Next.js for the web chat, case-file page and server routes; deploy on Vercel.
- Supabase for Postgres (data) and Storage (uploaded files).
- Meta Model API through the OpenAI SDK, base URL https://api.meta.ai/v1. Keep model name, base URL and key in configuration so the model can be swapped.
- If an agent run exceeds the host’s time limit, process it in a background task. Propose any move to a separate worker before doing it.
- No vector database, no custom OCR, no user accounts. Access is by unguessable case links.

## 3. Architecture rules

- **Channel-agnostic agent core.** A case goes in (files, notes, history); messages and findings come out. The web chat is a thin adapter, so WhatsApp can be added later.
- **Tool-calling loop** capped at about 8 tool calls per turn, with a hard timeout and a plain-language fallback message.
- **Structured output** for extraction and verdicts. Validate every model output against a schema; retry once; otherwise mark the field low-confidence.
- **Numbers and verdicts come from code, never from the model.** The model reads, reasons and explains; deterministic functions evaluate origin and compute duty.
- **Append-only events table** recording every tool call, model call, decision and correction with a timestamp. It powers the audit trail and the case file.
- **Replay mode.** Save one real run of the sample shipment and replay it if live processing fails, clearly labelled as a replay.

## 4. Agent tools

| Tool | Kind | Purpose |
| --- | --- | --- |
| extract\_documents | Model | Read photos and PDFs into structured fields with per-field confidence |
| crosscheck\_documents | Code + model | Compare fields across documents; return discrepancies with both values and sources |
| lookup\_hs | Model + data | Propose one classification and up to two alternatives from the rules pack |
| get\_tariff\_row | Code | Preferential and standard rate for the importer, with source and as-of date |
| get\_origin\_rule | Code | Rule text and rule type for the product |
| evaluate\_origin | Code | Deterministic verdict, including cumulation, with steps to show the user |
| compute\_duty | Code | Duty at both rates on the declared value |
| ask\_user | Control | Pause and ask at most two questions |
| request\_approval | Control | Stop at a decision gate and wait for Approve, Correct or Not now |
| save\_correction, recall\_corrections | Code | Store and apply corrections by client and similar description; always announce use |

The agent has no tool to submit, certify or contact third parties. That is deliberate.

## 5. Data to create during the build window

- **Rules pack** (versioned JSON): three product families covering wholly obtained, change of tariff heading and value percentage. Every entry carries source document, section or page, and an as-of date. Sources: official AfCFTA texts and the e-Tariff Book (no documented API; extract by hand).
- **Synthetic documents:** invoices, packing lists, transport documents, a supplier invoice; include at least one degraded phone photo.
- **Ten test bundles** with an answer key, seeded errors and trap cases (unsupported product, missing information).

## 6. Meta model settings

- Use muse-spark-1.3 in Standard mode for the live demo. Contributor mode is cheaper but lets Meta train on your content and is capped at 150 requests per minute, so use it for development with synthetic data only. Confirm exact model IDs on the Model list page.
- Cache the static rules text. PDFs: text from the first 100 pages plus images of the first 50. Images: PNG, JPEG, GIF or WebP.
- **Voice (stretch):** Muse Voice Transcribe accepts WAV only (mono 16-bit PCM, 16 or 24 kHz, 10 minutes max) and supports English and French, not Swahili or Hausa. Convert recordings first.
- **Late and optional:** a config switch to run on Muse Spark Open through Baseten (model ID meta-models/muse-spark-open-1026) for the open-weights prize. Test once; drop it if it fails.
- **Budget:** $150 credit. Log token use per case and stop heavy test runs at 80%.

## 7. Build order

1. 27–28 Oct, slice 1: web chat, upload, extraction, case summary, cross-check (F1–F3). Done when a three-document bundle gives a correct summary and finds the seeded errors.
2. 29–30 Oct, slice 2: rules pack, classification, tariff, origin evaluator, duty, guided resolution, decision gates, audit trail (F4–F8). Done when a verdict flips after new evidence and approval is recorded.
3. 31 Oct–1 Nov, slice 3: correction memory, case file, built-in sample shipment, replay (F9–F10). Feature freeze on 1 Nov.
4. 2 Nov: evaluation run, demo video, README.
5. 3–4 Nov: final testing; submit by 6:00 PM ET on 4 Nov.

Stretch, only after the core works: voice, WhatsApp, open-weights switch.

## 8. Quality gate

- An evaluation script runs the ten test bundles and prints discrepancy recall, false alarms, verdict accuracy and trap behaviour. Targets are in PRD Section 12. Run it before every merge; a change that lowers results does not merge.
- Final check: the sample shipment completes live in 9 of 10 runs, from a clean browser and from a phone.
