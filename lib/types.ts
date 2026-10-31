// Slice 1 domain types: F1 intake, F2 summary, F3 cross-check.
// Channel-agnostic: the web chat is a thin adapter over these types.

export type DocType =
  | "commercial_invoice"
  | "packing_list"
  | "transport_document"
  | "supplier_invoice"
  | "unknown"
  | "unsupported";

export interface CaseFacts {
  exporter?: string | null;
  importer?: string | null;
  productDescription?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  totalValue?: number | null;
  currency?: string | null;
  invoiceDate?: string | null;
  shipmentDate?: string | null;
  deliveryTerms?: string | null;
  transportMode?: string | null;
  transportRef?: string | null;
  invoiceRef?: string | null;
  originStatement?: string | null;
  declaredHsCode?: string | null;
}

export interface DocumentExtraction {
  docType: DocType;
  docTypeConfidence: number;
  fields: CaseFacts;
  /** 0-1 per field name in CaseFacts, plus "docType". Missing = 0. */
  fieldConfidence: Record<string, number>;
  unreadable: boolean;
  note?: string | null;
}

export interface StoredDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  extraction: DocumentExtraction | null;
  createdAt: string;
}

export type Severity = "Blocking" | "Check" | "Note";

export interface Discrepancy {
  id: string;
  severity: Severity;
  field: string;
  label: string;
  valueA: string;
  sourceA: string;
  valueB: string;
  sourceB: string;
  suggestion: string;
  resolved: boolean;
  resolvedValue?: string | null;
  resolvedReason?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export type CaseStatus = "intake" | "ready" | "needs_input";

export interface CaseRecord {
  id: string;
  note: string | null;
  status: CaseStatus;
  documents: StoredDocument[];
  discrepancies: Discrepancy[];
  unchecked: string[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentEvent {
  id: string;
  caseId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
