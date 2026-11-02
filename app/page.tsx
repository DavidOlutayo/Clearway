"use client";

import { useEffect, useRef, useState } from "react";
import type { CaseRecord, CaseStatus, ChatMessage, Discrepancy } from "@/lib/types";

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
              <span className="text-slate-400">{line.slice(0, sep)}:</span>{" "}
              <span className="font-semibold text-white">{line.slice(sep + 2)}</span>
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

function Bubble({
  message,
  status,
  hasTimeoutMessage,
  busy,
}: {
  message: ChatMessage;
  status: CaseStatus;
  hasTimeoutMessage: boolean;
  busy: boolean;
}) {
  const mine = message.role === "user";
  const isTimeoutNotice = !mine && message.text.startsWith("Still working");
  const isReadingNotice = !mine && message.text.includes("Reading them now");
  const isWorkingNotice = isTimeoutNotice || isReadingNotice;
  const showSpinner = isTimeoutNotice ? busy : status === "intake" && !hasTimeoutMessage;
  return (
    <div className={`cinematic-enter flex ${mine ? "justify-end" : "justify-start"}`}>
      <pre
        className={`my-1 max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2.5 font-sans text-sm shadow-sm ${
          mine ? "bg-blue-600 text-white" : "border border-white/10 bg-white/5 text-white shadow-lg backdrop-blur-md"
        }`}
      >
        {mine ? (
          message.text
        ) : isWorkingNotice ? (
          <div className="flex items-start gap-3">
            {showSpinner ? (
              <svg
                className="w-5 h-5 animate-spin text-[#79dce8] shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-slate-500 shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        ) : (
          <BubbleLabelValue text={message.text} />
        )}
      </pre>
    </div>
  );
}

interface AuditEntry {
  timestamp: string;
  issue: string;
  resolution: string;
}

function DiscrepancyRow({
  disc,
  caseId,
  onResolved,
  onOverride,
}: {
  disc: Discrepancy;
  caseId: string;
  onResolved: (record: CaseRecord) => void;
  onOverride: (disc: Discrepancy, chosenValue: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopened, setReopened] = useState(false);

  async function resolveWith(value: string) {
    setBusy(true);
    try {
      const data = await postJson(`/api/cases/${caseId}/resolve`, {
        discrepancyId: disc.id,
        correctValue: value,
        reason: reason.trim() === "" ? undefined : reason,
      });
      onResolved(data.case as CaseRecord);
      onOverride(disc, value);
      setReopened(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Resolve failed.");
    } finally {
      setBusy(false);
    }
  }

  if (disc.resolved && !reopened) {
    return (
      <div className="cinematic-enter mb-3 rounded-xl border border-transparent bg-white/5 px-3 py-2 text-[13px]">
        <span className="text-green-300">✓ {disc.label}: </span>
        <span className="text-slate-400 font-medium">using</span>{" "}
        <span className="text-white font-bold">{disc.resolvedValue}</span>
        <button
          onClick={() => {
            setReason("");
            setReopened(true);
          }}
          className="text-sm text-[#79dce8] hover:text-white hover:underline ml-3 transition-all duration-300"
        >
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="cinematic-enter my-1.5 rounded-xl border border-white/10 bg-white/5 p-2 shadow-lg backdrop-blur-md text-white">
      <div className="text-[13px] font-semibold">
        <span
          className={`rounded-md border px-2 py-1 text-xs font-bold ${
            disc.severity === "Blocking"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : disc.severity === "Check"
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"
                : "border-white/10 bg-white/10 text-slate-300"
          }`}
        >
          {disc.severity}
        </span>
        : {disc.label}
      </div>
      <div className="text-[13px]">
        <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">{disc.valueA}</span>
        <span className="text-slate-400"> ({disc.sourceA}) vs </span>
        <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">{disc.valueB}</span>
        <span className="text-slate-400"> ({disc.sourceB})</span>
      </div>
      <div className="my-1 text-xs text-slate-300">{disc.suggestion}</div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        className="mb-1.5 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[13px] text-white placeholder-white/50 outline-none focus:border-[#79dce8] focus:ring-1 focus:ring-[#79dce8]"
      />
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => resolveWith(disc.valueA)}
          className="rounded-full bg-gradient-to-b from-white to-slate-50 text-slate-800 border border-slate-200 shadow-md hover:scale-[1.02] transition-all px-5 py-2.5 font-medium text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use {disc.valueA.slice(0, 24)}
        </button>
        <button
          disabled={busy}
          onClick={() => resolveWith(disc.valueB)}
          className="rounded-full bg-gradient-to-b from-white to-slate-50 text-slate-800 border border-slate-200 shadow-md hover:scale-[1.02] transition-all px-5 py-2.5 font-medium text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Use {disc.valueB.slice(0, 24)}
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
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [activeDoc, setActiveDoc] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processTimedOut, setProcessTimedOut] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const file = localFiles[activeDoc] ?? null;
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFiles, activeDoc]);

  async function refresh(caseId: string) {
    const res = await fetch(`/api/cases/${caseId}`);
    const data = (await res.json()) as { case: CaseRecord };
    setRecord(data.case);
  }

  async function runProcess(caseId: string): Promise<boolean> {
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
    let timedOut = false;
    try {
      const result = await postJson(`/api/cases/${caseId}/process`, {});
      timedOut = (result.timedOut as boolean) === true;
    } finally {
      clearTimeout(timer);
    }
    await refresh(caseId);
    return timedOut;
  }

  async function startCase() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) {
      alert("Choose 1–8 photos or PDFs first.");
      return;
    }
    const chosen = Array.from(files).slice(0, 8);
    setLocalFiles(chosen);
    setActiveDoc(0);
    setBusy(true);
    let caseId = "";
    try {
      const created = await postJson("/api/cases", { note });
      caseId = (created.caseId as string) ?? "";
      const form = new FormData();
      for (const file of chosen) form.append("files", file);
      const upload = await fetch(`/api/cases/${caseId}/upload`, { method: "POST", body: form });
      if (!upload.ok) {
        const err = (await upload.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof err.error === "string" ? err.error : "Upload failed.");
      }
      await refresh(caseId);
      try {
        setProcessTimedOut(await runProcess(caseId));
      } catch (error) {
        // Processing failed before completing; the server kept the upload
        // pending, so offer the retry the failure message promises.
        setProcessTimedOut(true);
        throw error;
      }
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

  async function retryProcess() {
    if (!record || busy) return;
    setBusy(true);
    try {
      setProcessTimedOut(await runProcess(record.id));
    } catch (error) {
      setProcessTimedOut(true);
      alert(error instanceof Error ? error.message : "Retry failed.");
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

  const activeFile = localFiles[activeDoc] ?? null;

  if (!record) {
    return (
      <main className="relative h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-black">
        <style>{`
          @keyframes slideUpFade {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .cinematic-enter { animation: slideUpFade 0.5s ease-out both; }
          @media (prefers-reduced-motion: reduce) {
            .cinematic-enter { animation: none; }
          }
        `}</style>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202422_3ffb4889-c520-432d-8458-038009eb40df.mp4"
        />
        <div className="cinematic-enter z-10 flex flex-col items-center max-w-2xl w-full text-center relative">
          <h1 className="text-7xl md:text-8xl font-serif text-white mb-6 tracking-wide drop-shadow-2xl">Clearway</h1>
          <div className="mb-4 mx-auto h-[2px] w-16 bg-[#79dce8] shadow-[0_0_12px_rgba(121,220,232,0.8)]" />
          <p className="mb-6 text-sm text-white/70">
            Upload the client bundle. I read it, compare documents, and flag disagreements. You decide what is correct.
          </p>

          <section className="w-full">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Short note (optional), e.g. Ghana → Kenya, textiles"
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 text-white placeholder-white/60 shadow-lg outline-none focus:ring-2 focus:ring-[#79dce8] transition-all w-full max-w-md mx-auto mb-4"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 text-sm text-white placeholder-white/60 shadow-lg outline-none focus:ring-2 focus:ring-[#79dce8] transition-all w-full max-w-md mx-auto mb-4 file:mr-3 file:rounded-full file:border-0 file:bg-white/20 file:px-4 file:py-1 file:text-sm file:font-medium file:text-white hover:file:bg-white/30"
            />
            <div className="mt-6">
              <button
                disabled={busy}
                onClick={startCase}
                className="rounded-full bg-white text-[#04101f] font-bold tracking-widest uppercase px-10 py-4 mt-4 hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {busy ? "Working…" : "Start case"}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex w-full overflow-hidden bg-[#04101f] text-slate-200">
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cinematic-enter { animation: slideUpFade 0.5s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .cinematic-enter { animation: none; }
        }
      `}</style>
      {isViewerOpen && (
      <section aria-label="Document Viewer" className="bg-slate-800 w-[60%] h-full">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-200">Document Viewer</h2>
            {activeFile && <p className="truncate text-xs text-slate-400">{activeFile.name}</p>}
          </div>
          {localFiles.length > 1 && (
            <div className="flex gap-1 overflow-x-auto px-4 pb-2">
              {localFiles.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  onClick={() => setActiveDoc(index)}
                  className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${
                    index === activeDoc ? "bg-slate-600 text-white" : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 px-4 pb-4">
            {activeFile && previewUrl ? (
              activeFile.type === "application/pdf" ? (
                <embed src={previewUrl} type="application/pdf" className="h-full w-full rounded-lg bg-white" />
              ) : activeFile.type.startsWith("image/") ? (
                <img src={previewUrl} alt={activeFile.name} className="h-full w-full rounded-lg bg-white object-contain" />
              ) : (
                <p className="text-sm text-slate-300">Preview not available for this file type.</p>
              )
            ) : (
              <div className="rounded-lg bg-slate-700 p-4">
                <p className="mb-2 text-sm text-slate-200">Preview unavailable — these files were uploaded in an earlier session.</p>
                <ul className="space-y-1">
                  {record.documents.map((doc) => (
                    <li key={doc.id} className="text-xs text-slate-300">
                      {doc.fileName} · {doc.mimeType}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
      )}
      <section className={`${isViewerOpen ? "w-[40%]" : "w-full"} h-full overflow-y-auto bg-transparent`}>
        <div className="p-4">
          <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-2 flex justify-end bg-[#04101f] px-4 py-2">
            <button
              onClick={() => setIsViewerOpen((open) => !open)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-4 py-2 text-xs font-medium transition-all"
            >
              {isViewerOpen ? "Hide Document" : "Show Document"}
            </button>
          </div>
          <div className="mx-auto max-w-[800px]">
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-white">Clearway — shipment readiness</h1>
          <p className="mb-4 text-sm text-slate-400">
            Upload the client bundle. I read it, compare documents, and flag disagreements. You decide what is correct.
          </p>
          <section>
            {record.messages.map((message) => (
              <Bubble
                key={message.id}
                message={message}
                status={record.status}
                hasTimeoutMessage={record.messages.some((m) => m.text.startsWith("Still working"))}
                busy={busy}
              />
            ))}
          </section>

          {record.discrepancies.length > 0 && (
            <section className="mt-3">
              <h2 className="mt-6 mb-4 text-[15px] font-semibold text-white">Disagreements</h2>
              {record.discrepancies.map((disc) => (
                <DiscrepancyRow
                  key={disc.id}
                  disc={disc}
                  caseId={record.id}
                  onResolved={setRecord}
                  onOverride={(d, chosenValue) =>
                    setAuditTrail((prev) => [
                      ...prev,
                      { timestamp: new Date().toISOString(), issue: d.label, resolution: chosenValue },
                    ])
                  }
                />
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
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:border-[#79dce8] focus:ring-1 focus:ring-[#79dce8]"
            />
            <button
              disabled={busy}
              onClick={() => void send()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              Send
            </button>
          </section>
          {processTimedOut && (
            <button
              disabled={busy}
              onClick={() => void retryProcess()}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {busy ? "Working…" : "Retry processing"}
            </button>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Case {record.id.slice(0, 8)} · {record.status} · {record.documents.length} documents
          </p>
          {record.status === "ready" && (
            <section className="cinematic-enter bg-slate-900/80 border-l-4 border-[#79dce8] p-4 rounded-r-xl mt-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">Session Audit Trail</h2>
              {auditTrail.length === 0 ? (
                <p className="text-xs text-slate-400">No manual overrides this session.</p>
              ) : (
                <ul className="space-y-1">
                  {auditTrail.map((entry, index) => (
                    <li key={index} className="font-mono text-xs text-slate-200">
                      {entry.timestamp} · {entry.issue} → {entry.resolution}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          </div>
        </div>
      </section>
    </main>
  );
}
