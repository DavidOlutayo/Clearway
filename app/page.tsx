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

function BubbleLabelValue({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, index, lines) => {
        const sep = line.indexOf(": ");
        const content =
          sep === -1 ? (
            line
          ) : (
            <>
              <span className="text-gray-500">{line.slice(0, sep)}:</span>{" "}
              <span className="font-semibold text-gray-900">{line.slice(sep + 2)}</span>
            </>
          );
        return (
          <span key={index}>
            {content}
            {index < lines.length - 1 ? "\n" : ""}
          </span>
        );
      })}
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <pre
        className={`my-1 max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2.5 font-sans text-sm shadow-sm ${
          mine ? "bg-blue-600 text-white" : "border border-gray-100 bg-white text-stone-900"
        }`}
      >
        {mine ? message.text : <BubbleLabelValue text={message.text} />}
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
      <div className="py-1.5 text-[13px] text-green-700">
        ✓ {disc.label}: using “{disc.resolvedValue}”
      </div>
    );
  }
  return (
    <div className="my-1.5 rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
      <div className="text-[13px] font-semibold">
        <span
          className={`rounded-md px-2 py-1 text-xs font-bold ${
            disc.severity === "Blocking"
              ? "bg-red-50 text-red-700"
              : disc.severity === "Check"
                ? "bg-amber-50 text-amber-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {disc.severity}
        </span>
        : {disc.label}
      </div>
      <div className="text-[13px]">“{disc.valueA}” ({disc.sourceA}) vs “{disc.valueB}” ({disc.sourceB})</div>
      <div className="my-1 text-xs text-stone-600">{disc.suggestion}</div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        className="mb-1.5 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => resolveWith(disc.valueA)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-900"
        >
          Use “{disc.valueA.slice(0, 24)}”
        </button>
        <button
          disabled={busy}
          onClick={() => resolveWith(disc.valueB)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-gray-900"
        >
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
    let caseId = "";
    try {
      const created = await postJson("/api/cases", { note });
      caseId = (created.caseId as string) ?? "";
      const form = new FormData();
      for (const file of Array.from(files).slice(0, 8)) form.append("files", file);
      const upload = await fetch(`/api/cases/${caseId}/upload`, { method: "POST", body: form });
      if (!upload.ok) {
        const err = (await upload.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof err.error === "string" ? err.error : "Upload failed.");
      }
      await refresh(caseId);
      await runProcess(caseId);
    } catch (error) {
      // The server records failures as chat messages; show them so a
      // failed start never leaves the chat looking dead.
      if (caseId !== "") {
        await refresh(caseId).catch(() => undefined);
      }
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
    <main className="mx-auto max-w-[680px] p-4">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-stone-900">Clearway — shipment readiness</h1>
      <p className="mb-4 text-sm text-stone-600">
        Upload the client bundle. I read it, compare documents, and flag disagreements. You decide what is correct.
      </p>

      {!record && (
        <section className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Short note (optional), e.g. Ghana → Kenya, textiles"
            className="mb-2 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
          />
          <div className="mt-2">
            <button
              disabled={busy}
              onClick={startCase}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
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
            <section className="mt-3">
              <h2 className="mb-1 text-[15px] font-semibold text-stone-900">Disagreements</h2>
              {record.discrepancies.map((disc) => (
                <DiscrepancyRow key={disc.id} disc={disc} caseId={record.id} onResolved={setRecord} />
              ))}
            </section>
          )}

          <section className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder={'Correct me ("the quantity is 500") or ask "what\'s missing?"'}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              disabled={busy}
              onClick={() => void send()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              Send
            </button>
          </section>
          <p className="mt-2 text-xs text-stone-500">
            Case {record.id.slice(0, 8)} · {record.status} · {record.documents.length} documents
          </p>
        </>
      )}
    </main>
  );
}
