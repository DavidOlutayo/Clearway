Built during the Meta Global AI Developer Hackathon, 27 Oct to 4 Nov 2026.

# Clearway — Clearance Readiness Copilot

Slice 1 (done, unrun): chat bundle intake (F1), case summary (F2),
cross-document consistency check (F3). Classification, tariff, origin,
duty, gates, memory and case file land in slices 2–3.

## Run (when ready)

```sh
cd Clearway
cp .env.example .env   # set META_API_KEY
npm install
npm run dev
```

Open http://localhost:3000 in a browser, upload 1–8 photos or PDFs,
and follow the chat. Supabase is optional in slice 1: without it the
app runs in-memory and still appends events locally.
