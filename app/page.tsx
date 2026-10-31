"use client";

import { useRef, useState } from "react";
import type { CaseRecord, ChatMessage, Discrepancy } from "@/lib/types";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) ?? "Request failed.");
  return data;
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
      <pre
        style={{
          background: mine ? "#1f6feb" : "#ffffff",
          color: mine ? "#ffffff" : "#111111",
          padding: "10px 12px",
          borderRadius: 10,
          maxWidth: "85%",
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          fontSize: 14,
          margin: "4px 0",
          border: mine ? "none" : "1px solid #e2ded4",
        }}
      >
        {message.text}
      </pre>
    </div>
  );
}

function DiscrepancyRow({
  disc,
  caseId,
  onResolved,
}: {
  disc: Discrepancy;
  caseId: string;
  onResolved: (record: CaseRecord) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolveWith(value: string) {
    setBusy(true);
    try {
      const data = await postJson(`/api/cases/${caseId}/resolve`, {
        discrepancyId: disc.id,
        correctValue: value,
        reason: reason.trim() === "" ? undefined : reason,
      });
      onResolved(data.case as CaseRecord);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Resolve failed.");
    } finally {
      setBusy(false);
    }
  }

  if (disc.resolved) {
    return (
      <div style={{ fontSize: 13, padding: "6px 0", color: "#2f6b2f" }}>
        ✓ {disc.label}: using “{disc.resolvedValue}”
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid #e2ded4", borderRadius: 8, padding: 8, margin: "6px 0", background: "#fff" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        {disc.severity}: {disc.label}
      </div>
      <div style={{ fontSize: 13 }}>“{disc.valueA}” ({disc.sourceA}) vs “{disc.valueB}” ({disc.sourceB})</div>
      <div style={{ fontSize: 12, color: "#555", margin: "4px 0" }}>{disc.suggestion}</div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        style={{ fontSize: 13, padding: 6, width: "100%", boxSizing: "border-box", marginBottom: 6 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={busy} onClick={() => resolveWith(disc.valueA)}>
          Use “{disc.valueA.slice(0, 24)}”
        </button>
        <button disabled={busy} onClick={() => resolveWith(disc.valueB)}>
          Use “{disc.valueB.slice(0, 24)}”
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [note, setNote] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh(caseId: string) {
    const res = await fetch(`/api/cases/${caseId}`);
    const data = (await res.json()) as { case: CaseRecord };
    setRecord(data.case);
  }

  async function runProcess(caseId: string) {
    // Client-side progress note if the model run passes 20s (PRD F1.3).
    const timer = setTimeout(() => {
      setRecord((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                { id: `local-${Date.now()}`, role: "assistant", text: "Still reading — large bundles can take up to a minute.", createdAt: new Date().toISOString() },
              ],
            }
          : prev,
      );
    }, 20000);
    try {
      await postJson(`/api/cases/${caseId}/process`, {});
    } finally {
      clearTimeout(timer);
    }
    await refresh(caseId);
  }

  async function startCase() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      alert("Choose 1–8 photos or PDFs first.");
      return;
    }
    setBusy(true);
    try {
      const created = await postJson("/api/cases", { note });
      const caseId = (created.caseId as string) ?? "";
      const form = new FormData();
      for (const file of Array.from(files).slice(0, 8)) form.append("files", file);
      await fetch(`/api/cases/${caseId}/upload`, { method: "POST", body: form });
      await refresh(caseId);
      await runProcess(caseId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Start failed.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!record || input.trim() === "") return;
    setBusy(true);
    try {
      const data = await postJson(`/api/cases/${record.id}/message`, { text: input });
      setRecord(data.case as CaseRecord);
      setInput("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20 }}>Clearway — shipment readiness</h1>
      <p style={{ fontSize: 14, color: "#555" }}>
        Upload the client bundle. I read it, compare documents, and flag disagreements. You decide what is correct.
      </p>

      {!record && (
        <section style={{ background: "#fff", border: "1px solid #e2ded4", borderRadius: 10, padding: 12 }}>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Short note (optional), e.g. Ghana → Kenya, textiles"
            style={{ width: "100%", boxSizing: "border-box", padding: 8, marginBottom: 8 }}
          />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple />
          <div style={{ marginTop: 8 }}>
            <button disabled={busy} onClick={startCase}>
              {busy ? "Working…" : "Start case"}
            </button>
          </div>
        </section>
      )}

      {record && (
        <>
          <section>
            {record.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
          </section>

          {record.discrepancies.length > 0 && (
            <section style={{ marginTop: 12 }}>
              <h2 style={{ fontSize: 15 }}>Disagreements</h2>
              {record.discrepancies.map((disc) => (
                <DiscrepancyRow key={disc.id} disc={disc} caseId={record.id} onResolved={setRecord} />
              ))}
            </section>
          )}

          <section style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder='Correct me ("the quantity is 500") or ask "what\'s missing?"'
              style={{ flex: 1, padding: 10 }}
            />
            <button disabled={busy} onClick={() => void send()}>
              Send
            </button>
          </section>
          <p style={{ fontSize: 12, color: "#777" }}>
            Case {record.id.slice(0, 8)} · {record.status} · {record.documents.length} documents
          </p>
        </>
      )}
    </main>
  );
}
