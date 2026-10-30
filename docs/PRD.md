# Clearance Readiness Copilot Clearway — Product Requirements Document

*Working title · Version 1.1 · 27 October 2026 · Hackathon MVP, indie track · Describes product behaviour only; technical decisions come later*

## 1. Product overview

**What it is.** A chat-based copilot (web chat first; WhatsApp is an optional later channel) for small freight forwarders and customs clearing agents. The agent uploads a client’s shipment documents (phone photos and PDFs) into the chat. The copilot reads them, assembles a structured case, flags inconsistencies, suggests the product’s tariff classification, checks whether the shipment is likely to qualify for AfCFTA preferential duty, explains what is missing or blocking, and shows how much duty is at stake. The agent reviews, corrects and approves in the same chat. The copilot remembers corrections and applies them to later shipments.

**What it is not.** It does not clear goods, submit customs declarations, issue or validate certificates of origin, or give legal advice. It is also not a general AfCFTA question-and-answer chatbot: it works on one shipment case at a time. The licensed agent and the customs authority remain responsible for every declaration and decision.

**Why it exists.** Preferential duty under the AfCFTA depends on three things lining up: the importing country’s tariff schedule for the product, the product-specific rule of origin, and consistent documents that prove both. This information is technical, held by different institutions, and applied differently from country to country. Small agents assemble it by hand from photographed and emailed paperwork, and errors tend to surface late, at the border, when they cost the most.

**Goal.** Take an officer from a messy bundle to an approved, evidence-backed readiness case in a few minutes, with errors caught before the border. The baseline time is to be measured with forwarders.

**Why not a general AI assistant?** A general assistant can read a document, but it does not hold a verified, dated set of the importing country’s tariff rows and origin rules, it can give different figures on different runs, and it does not stop at approval gates, keep an audit trail or remember a forwarder’s corrections. The copilot’s edge is the workflow around the reading, not the reading alone. **Kill number:** if a general assistant, given the same documents and the same official texts, matches the copilot on 8 or more of 10 test cases for verdict correctness and discrepancy detection, the pitch must lead with workflow value (gates, audit trail, memory) instead of intelligence.

**Larger vision.** This MVP is the first concrete expression of a broader product vision: zero-touch intake of messy information, asynchronous human decisions, and a memory that learns from those decisions. The MVP demonstrates that loop on one narrow, real problem.

**Product principles**

1. Zero retyping: the user never re-enters data that is already in a document.
2. Evidence over confidence: every conclusion shows the facts and the official source it rests on.
3. The human decides: the product prepares; the agent approves.
4. Narrow and honest: it states what it supports and says “I can’t determine this” instead of guessing.
5. It learns from the human: corrections change future behaviour, visibly.

## 2. Problem

**Problem statement.** A forwarder’s documentation officer has to decide, shipment by shipment, whether a client’s goods can claim AfCFTA preferential duty and whether the paperwork will hold up. That means reading inconsistent documents, finding the right tariff line, looking up the origin rule, asking the client for missing facts, and keeping track of everything across chat threads, photos and spreadsheets.

**Current workflow (hypothesis to validate)**

1. The client sends photos and PDFs by chat or email.
2. The officer retypes the data into their own records and into the national customs process.
3. The officer searches tariff schedules and origin rules by hand.
4. The officer chases the client for missing documents or facts.
5. Inconsistencies are discovered late, often at or near the border.

**Consequences (hypotheses to validate)**

- Preferential duty is lost, or never claimed, because eligibility is unclear.
- Shipments are queried or held because documents disagree.
- Time is lost to retyping and chasing.
- The same classification mistakes recur.

**Validation required.** Before and during the build, confirm with at least two practising forwarders on the chosen route: how documents actually arrive, the most common reasons for queries or holds, how long a typical case takes, and what they would pay for. Findings may change priorities in this document.

## 3. Target user

**Primary user.** A documentation officer or clearing agent at a small freight forwarder or customs clearing agency, preparing shipments for small and medium exporters on one AfCFTA trade route. The MVP serves the agent at the exporting end of the route, who prepares the documents and the origin claim; agents at the importing end are a later extension. Context: works under time pressure, receives documents as phone photos and PDFs, replies from a phone or laptop throughout the day, and is accountable for accuracy. Works in English.

**Indirect user (MVP).** The exporter who supplies the documents and the facts the officer needs (for example, where an input comes from). In the MVP the exporter does not use the product directly; the officer relays.

**Not a user.** Customs officials and government systems.

## 4. User journey

1. **Trigger.** A client sends the officer a bundle for an upcoming shipment: an invoice photo, a packing list, a transport document.
2. **Intake.** The officer uploads the files into the copilot’s chat with a short note, or starts the built-in sample shipment. The copilot acknowledges immediately and reports progress.
3. **Understanding.** The copilot states what it read: document types, key facts, and any fields it could not read confidently.
4. **Consistency review.** The copilot lists discrepancies between documents, each with both conflicting values and where they came from.
5. **Classification.** The copilot proposes a tariff classification with alternatives and asks the officer to confirm or change it.
6. **Preference check.** The copilot states whether AfCFTA preference is likely to apply for this route and product, the rate difference, and the duty at stake.
7. **Resolution.** If origin is not met or information is missing, the copilot names what is blocking, proposes options, and asks for the specific missing fact or document. The officer supplies it (typed, or as a photo of a document). The copilot re-evaluates immediately.
8. **Approval.** The officer approves or corrects. An approved case is marked Ready for handoff, with a summary the officer can use in their own process.
9. **Learning.** Corrections are saved. On the next shipment from the same client, the copilot applies them and says so.

**In one line:** messy documents and an eligibility uncertainty go in; the copilot reads, compares, classifies and checks the rules; the officer confirms, corrects and approves; the outcome is an evidence-backed case with a clear duty figure and a clean record of who decided what.

**Exit states.** Every case ends in one of four states:

- **Ready for handoff:** the officer approved the case.
- **Proceed without preference:** origin is not met and the officer accepts standard duty.
- **Needs the authority:** the copilot cannot determine the outcome; the officer takes it to the issuing authority or customs.
- **Parked:** waiting on the exporter, with a list of what is outstanding.

## 5. Core use cases

- **UC1 Start a case.** Forward a document bundle and get a “what I understood” summary without retyping anything.
- **UC2 Review discrepancies.** See what disagrees across documents and decide which value is right.
- **UC3 Confirm classification.** Review the suggested tariff classification and alternatives; confirm or change.
- **UC4 Learn whether preference applies.** See a clear verdict, the rule behind it, and the duty at stake.
- **UC5 Resolve a blocked case.** Understand the single biggest blocker, supply the missing fact or document, and watch the verdict update.
- **UC6 Approve or correct.** Sign off a case as ready for handoff, or correct the copilot and have the correction remembered.
- **UC7 Reuse learning.** On a later shipment from the same client, see earlier corrections applied automatically.
- **UC8 Review the record.** Open the case file to see evidence, reasoning steps and decision history; or, as a reviewer, run the built-in sample shipment.

## 6. Features (MVP only)

- **F1 Bundle intake** (zero retyping)
- **F2 Case summary** (“what I understood”)
- **F3 Cross-document consistency check**
- **F4 Tariff classification suggestion** with alternatives
- **F5 AfCFTA preference and origin check** (supported scope only)
- **F6 Duty-at-stake estimate**
- **F7 Guided resolution** (questions and remedy options)
- **F8 Decision gates and audit trail**
- **F9 Correction memory**
- **F10 Read-only case file and built-in sample shipment**

## 7. Functional requirements

**F1 — Bundle intake**

1.1 Accept one to eight files per case: photographs (including tilted, shadowed or low-light ones) and PDF documents, plus an optional short text note.

1.2 Identify each document’s type (commercial invoice, packing list, transport document, supplier or input invoice) and tell the user what it recognised.

1.3 Acknowledge receipt within 5 seconds; send a progress update if processing takes longer than 20 seconds.

1.4 Deliver the first full report within 60 seconds for a standard three-document bundle (target).

1.5 If a file is unreadable or not a supported document, say which one, ask for a better copy, and continue with the rest.

1.6 Detect a repeated upload and ignore it, with a note.

1.7 Never ask the user to type information that is present in a readable document.

**F2 — Case summary**

2.1 Show key facts per document: parties, dates, product description, quantities, weights, value and currency, delivery terms, transport mode and references, and any statements about origin.

2.2 Mark any field read with low confidence so the user can check it.

2.3 Let the user correct any field by replying in plain language; show the corrected value immediately and re-run dependent checks.

**F3 — Consistency check**

3.1 Compare documents with each other on parties, quantities, weights, values and currency, product descriptions, dates, transport references and origin statements.

3.2 For each discrepancy show: severity (Blocking, Check, or Note), the two conflicting values, which document each came from, and a suggested resolution.

3.3 Let the user mark a discrepancy as resolved and say which value is correct, with an optional reason.

3.4 A case with unresolved Blocking discrepancies cannot be marked Ready for handoff.

**F4 — Classification suggestion**

4.1 Propose one main tariff classification (at the international six-digit level) and up to two alternatives, each with a short plain-language reason.

4.2 Flag when a code stated in the documents differs from the proposal.

4.3 Remind the user that the importing country’s national tariff line may be longer than six digits and must be confirmed by the user.

4.4 Treat classification as provisional until the user confirms it.

4.5 For products outside the supported families, say so and do not propose a classification.

**F5 — Preference and origin check**

5.1 Supported scope: one route (one exporting country to one importing country) and three product families, chosen to cover three kinds of origin logic: wholly obtained goods, a change of tariff heading, and a minimum percentage of originating value.

5.2 If the product is excluded from liberalisation in the importing country’s schedule, say so first; no origin analysis is needed.

5.3 For supported goods, give one of three verdicts: Likely eligible; Not eligible on current evidence; Cannot determine, information needed.

5.4 Show the applicable rule in plain language with its official reference, the facts the verdict used, and any calculation step by step.

5.5 Where cumulation or a tolerance allowance could change the outcome, say so and say what evidence it would require.

5.6 State the importing country’s schedule status as known (for example provisional or gazetted), the tariff year applied, any difference in treatment that depends on the exporting country’s status, and the date of the reference information.

5.7 Always include a short caution: pre-check only; confirm rates and origin with the issuing authority and the gazetted tariff.

5.8 For unsupported routes or products, say so plainly; never produce a verdict.

**F6 — Duty-at-stake estimate**

6.1 Show the duty at the preferential rate and at the standard rate on the declared shipment value, and the difference.

6.2 Label figures as estimates and show the rates used with their source.

6.3 When preference is not available, show the standard-rate duty and the saving that would be possible if the blocker were resolved.

**F7 — Guided resolution**

7.1 When the verdict is Not eligible or Cannot determine, name the single biggest blocker and explain in plain language why it matters.

7.2 Offer options ranked by practicality (for example: provide evidence that an input comes from another AfCFTA country; correct a misstatement; proceed without claiming preference).

7.3 Ask for the specific missing fact or document, at most two questions at a time.

7.4 Accept answers as text or as a photo of a document; re-evaluate immediately and show how the verdict and duty figures changed.

7.5 When the user supplies facts on the exporter’s behalf (such as where an input came from), ask them to confirm those facts come from the exporter’s records.

**F8 — Decision gates and audit trail**

8.1 Three gates: confirm classification, resolve discrepancies, approve readiness.

8.2 At each gate the user can Approve, Correct, or Not now.

8.3 Record who decided, when, what changed, and what the copilot had suggested.

8.4 Overrides need no justification but accept an optional reason.

8.5 When approved, mark the case Ready for handoff and send a concise summary with a link to the case file.

8.6 The product never submits anything outside the chat.

**F9 — Correction memory**

9.1 After any correction, ask whether to apply it to future shipments from this client or to this case only.

9.2 Apply saved corrections automatically to later cases for the same client and similar product descriptions, tell the user each time, and let them reverse it.

9.3 Let the user list and delete saved corrections.

**F10 — Case file and built-in sample shipment**

10.1 A read-only page, reached from a link in the chat, showing documents beside their extracted fields, discrepancies and resolutions, the classification decision, the origin analysis with sources, the duty estimate, and a step-by-step record of what the copilot did and who decided.

10.2 A built-in sample shipment: any reviewer can start it with one tap, without preparing files or signing up, and step through the same conversation, outputs and decision gates.

## 8. User interactions

**What the user can do**

- Upload photos and PDFs (or take a photo on a phone) and type short notes; start a new case or the built-in sample shipment; ask for status.
- Reply with corrections in plain language.
- Tap Approve, Correct or Not now at each gate.
- Ask “why?” about any finding, and “what’s missing?” at any time.
- Undo the last correction.
- Open the case file link.
- Stretch, first priority: answer by voice note (English or French).

**What the user sees (message types)**

1. Acknowledgement and progress.
2. “What I understood” summary.
3. Discrepancy card: the two values, where each came from, what to do.
4. Classification proposal with alternatives.
5. Verdict card: status label with a simple colour or symbol cue, one-line reason, duty figures, what is still needed, the caution line.
6. Question (one or two at a time).
7. Approval summary with the case file link.

**Message principles.** Conclusion first. Plain language; explain any term of art. Each message readable on a phone screen without scrolling (about eight lines). Buttons rather than typing wherever the choice is simple. Always say what happens next.

**What the user can reject or change.** Any extracted field, any discrepancy resolution, the classification, any supplied fact, any saved correction, and any approval (reopen the case).

## 9. AI behaviour

- Reads documents like a careful clerk: extracts what is there, marks what is uncertain, never invents values.
- Shows its working: points to the document, the value and the rule behind each conclusion.
- Uses calibrated language (“likely”, “on the evidence provided”) and never claims goods will clear or that a certificate will be valid.
- Prefers “I can’t determine this” to a guess, and says exactly what information would let it decide.
- Does arithmetic transparently, showing inputs and steps; the same inputs always give the same figures.
- Asks only what it needs, at most two questions at once, and says why it is asking.
- When documents conflict, presents both values and does not silently pick one.
- When a check fails, looks for remedies and presents them as options for the human, not as instructions.
- Applies remembered corrections only for the same client and similar descriptions, and says when it does.
- Stays within the shipment-readiness task; politely declines unrelated requests and returns to the case.
- Never produces anything that looks like an official certificate or customs form; any data sheet it prepares is clearly marked as a draft and not a valid document.
- Keeps a calm, professional tone and short messages.
- Adds the standard caution to every verdict.

**Confidence rules** (starting values, to tune in testing). A field is marked low-confidence when the copilot is less than about 80% sure of it. A classification proposal below about 70% is shown as “needs your judgement”, with the alternatives side by side. A verdict that depends on a low-confidence field says so and is never shown as Likely eligible.

**Never-do rules.** The copilot never:

- submits anything to customs or any government system;
- issues, validates or imitates a certificate of origin or other official form;
- says goods will clear or that a certificate will be accepted;
- gives a verdict outside the supported route and product families;
- invents a value, or converts currency silently;
- applies a saved correction without saying so;
- contacts the exporter or any third party;
- repeats sensitive details beyond what the user needs.

## 10. Human involvement

- **Gate 1:** the user confirms or changes the classification.
- **Gate 2:** the user decides which value is correct for each discrepancy.
- **Gate 3:** the user approves the case as Ready for handoff.
- The user confirms any fact supplied on the exporter’s behalf.
- The user decides whether a correction applies to future shipments.
- The user can override any AI finding at any time; overrides are logged.
- Final responsibility sits with the licensed agent and the customs authority. The product never submits, certifies or clears.
- When the copilot cannot determine something, it tells the user to consult the issuing authority or customs rather than substituting its own judgement.

**Autonomy and permissions**

| Level | What the copilot may do |
| --- | --- |
| On its own | Read files, extract facts, compare documents, suggest a classification, run origin and duty calculations, draft the summary, ask questions |
| Only with the user’s approval | Mark a classification confirmed, mark a discrepancy resolved, mark a case Ready for handoff, save a correction for future shipments |
| Never | Anything in the never-do rules in Section 9 |

## 11. Edge cases

1. **Blurry or cropped photo.** Flag the affected fields, ask for a retake, continue with the rest.
2. **Multi-page document, pages out of order.** Combine and state the assumption made.
3. **Mixed languages or unusual layouts.** Read what it can; flag the rest.
4. **Different currencies across documents.** Flag as a discrepancy; show both; never convert silently.
5. **A document type is missing (for example, no transport document).** Proceed with the checks that are possible and list what could not be checked.
6. **Same document uploaded twice, or two versions with different values.** Ignore exact duplicates; treat differing versions as a discrepancy.
7. **Declared classification does not match the description.** Flag and propose alternatives.
8. **Product outside the supported families.** Say so; no verdict; the case can still be summarised and checked for consistency.
9. **Unsupported route, or the importing country’s schedule for the product is unavailable.** Say so; no verdict.
10. **Product excluded from liberalisation.** State it first; no origin analysis.
11. **Shipment date falls outside the tariff year covered by the reference information.** Say so; show the nearest covered year, clearly flagged.
12. **Contradictory answers from the user.** Present the contradiction and ask which is correct.
13. **User reverses an earlier correction.** Apply the latest, keep the history, and change saved memory only if the user confirms.
14. **Unrelated question.** Decline briefly and return to the case.
15. **User returns after a long pause.** Give a short recap of where the case stands and what is outstanding.
16. **Two cases active at once.** Ask which case a new file belongs to.
17. **Very large bundle.** Process the first eight files and say so.
18. **Personal or sensitive data in documents.** Do not repeat it in messages beyond what is needed.
19. **User asks for legal advice or a guarantee.** Decline; explain that only customs and the issuing authority can decide.

## 12. Success criteria

Targets for the hackathon MVP:

1. **End-to-end reliability.** The sample case completes live, from first file to approval, without intervention in at least 9 of 10 consecutive rehearsals.
2. **Discrepancy detection.** On a prepared test set of at least ten bundles with known seeded errors, it finds at least 90% of the seeded discrepancies and raises on average no more than one false alarm per bundle.
3. **Reading accuracy.** Key fields are correct at least 95% of the time on clean documents. On degraded documents, uncertain fields are marked, and confident-but-wrong readings stay below 2% of fields.
4. **Verdict correctness.** Within the supported scope, verdicts match an answer key prepared from the official texts in every test case, and each verdict cites its source.
5. **Honesty.** In deliberate trap cases (unsupported product, missing information, conflicting facts), it abstains or asks rather than giving a confident verdict, every time.
6. **Speed.** First acknowledgement within 5 seconds; full report within 60 seconds for a three-document bundle.
7. **Reviewer effort** (measured informally with two forwarders). An officer completes review and approval of a prepared case in under three minutes of their own attention.
8. **Visible learning.** In the demo, a saved correction changes the outcome of a second case, and the product says so.
9. **Comprehension.** A first-time viewer can say what the product does and why it is useful within the first 60 seconds of the three-minute demo video, and the video clearly shows what was built during the hackathon.
10. **Safety.** No output claims clearance or legal certainty; every verdict carries the caution; no output resembles an official document.

## 13. MVP boundaries

**Scope in one line:** one route · three product families · English-language documents · one main channel.

**Must have**

- One route and three product families, confirmed by the data check in Appendix A.
- A web chat as the main interface, working on a phone or a laptop with no sign-up needed to try the sample shipment, with the interactions described above.
- Features F1 to F9.
- The read-only case file and built-in sample shipment (F10).
- Synthetic sample documents only; no real client data.
- A source reference and the standard caution on every verdict.

**Nice to have**

- Voice-note answers in English (and possibly French).
- A downloadable one-page summary of an approved case.
- A second route, or WhatsApp as a second channel for the same conversation.
- French-language documents.
- A short “what changed since last time” recap for returning clients.

**Not part of this hackathon**

- Submitting declarations to customs or any government system.
- Issuing, validating or imitating certificates of origin or other official forms.
- Multiple user accounts, organisations, roles or billing.
- General AfCFTA question-and-answer chat.
- Coverage beyond the three product families or the single route.
- Payments, trade finance, shipment tracking, booking.
- Dashboards, analytics, or reports across cases.
- Offline operation.
- Real client or customs data.
- Document languages other than English (beyond the nice-to-haves).

## 14. Harmful failures and owners

Six failures would hurt a user or the product’s credibility. During the hackathon the builder owns prevention; at each gate, the reviewing agent owns the final decision.

| Failure | Example | Prevention | Owner |
| --- | --- | --- | --- |
| Confident wrong verdict | Says Likely eligible when origin is not met | Verdicts only in the supported scope; repeatable calculations; a source and the caution on every verdict; abstain when unsure | Builder (rules, tests); agent (approval) |
| Silent misreading | A quantity or value read wrongly and not flagged | Low-confidence marks; cross-document checks; user confirms key fields | Builder (reading tests); agent (confirms) |
| Looks official | A draft data sheet mistaken for a certificate | Never imitate official forms; clear draft labels | Builder |
| Wrong memory applied | A correction for one client applied to another | Same client and similar description only; announced; reversible; listed | Builder; agent (can reverse) |
| Overclaiming | “Your goods will clear” | Calibrated language; never-do rules | Builder |
| Data exposure | Real client data shown or kept | Synthetic data only in the hackathon build; show only what is needed | Builder |

## 15. Operating rules, rollout and timeline

The build window is 27 Oct to 4 Nov. These rules keep the demo safe and give a pilot a path.

- **Monitoring.** For each case the builder can see the outcome, the time taken, any error, and what the user changed. A failed run shows the user a clear notice, never a silent gap.
- **Fallback.** If live processing fails in a demo, the built-in sample shipment can be replayed from a saved real run, clearly labelled as a replay.
- **Pause rule.** A change that drops test-set results below the success criteria is not shipped. If a product family’s rule or rate proves wrong, its verdicts are switched off and the copilot says “not supported” until it is fixed.
- **Cost limit.** Total model spend stays inside the $150 credit, with spend alerts at 50% and 80%.
- **ROI to show.** Time from bundle to approved case, and the duty saving or exposure per case; the baseline is measured with two forwarders.
- **Rollout after the hackathon.** A pilot with two or three forwarders on one route, one product family at a time; widen only while accuracy holds. About 6 to 8 weeks to a pilot-ready version.

**Hackathon timeline**

1. 27–28 Oct: lock the route, three products and sourced rules; create sample documents; first end-to-end run.
2. 29–30 Oct: guided resolution, decision gates, evaluation test set.
3. 31 Oct–1 Nov: correction memory, case file, voice stretch; feature freeze on 1 Nov.
4. 2 Nov: record the three-minute demo video; save the fallback replay.
5. 3 Nov: final testing, public repository clean-up, questions to the organisers.
6. 4 Nov: submit by 6:00 PM ET, three hours before the 9:00 PM ET deadline.

## Appendix A. Assumptions and open items to confirm before build

1. **Hackathon requirements (confirmed from the participant guide).** The project must fit a problem statement (this one fits “Build for Your World”) and use Meta’s models. Judging is a pass/fail fit check, then Impact 30%, Use of Meta AI tooling 25%, Demo 25% and Technical depth 20%. Submission is due 4 Nov, 9:00 PM ET: a public repository, a three-minute demo video and a live product. Everything shown must be built during the event (27 Oct to 4 Nov), and the demo must make that clear. Basic RAG apps and simple chatbots are listed as anti-projects, so the product must show an agent that acts, checks and stops for approval. Prize targeting and hosting choices are outside this PRD.
2. **Route and product families.** Lock on the first day of data work by confirming, for each chosen product, that the importing country’s tariff row and the origin rule can be found and cited from official sources. Default route: Ghana to Kenya. If a product cannot be sourced within 30 minutes, drop or replace it. Choose the three families to cover three kinds of origin logic (wholly obtained; change of tariff heading; minimum originating value).
3. **Reference accuracy.** Official AfCFTA texts and tariff schedules are the authority, and gazetted national rates prevail. Every piece of reference content must carry a source and an “as of” date.
4. **Forwarder validation.** Confirm the persona and workflow with at least two forwarders; update Sections 2 and 4 accordingly.
5. **Sample documents.** Synthetic, created during the building period (from 27 Oct), resembling real layouts; at least one degraded phone photo; at least two seeded discrepancies; at least one case that fails origin on the first pass and passes after a remedy.
6. **Illustrative numbers.** Any rate or threshold in demo scripts is a placeholder until replaced by verified reference values.

## Appendix B. Glossary

- **Tariff classification (HS code):** the international numbering of goods that determines which duty line applies.
- **Preferential duty:** a reduced or zero duty rate available only to goods that qualify under the trade agreement.
- **Rules of origin:** the product-specific tests that decide whether goods qualify as originating in the trade area.
- **Wholly obtained:** goods grown, extracted or produced entirely in the trade area.
- **Change of tariff heading:** an origin test met when inputs from outside the area are transformed enough to fall under a different heading.
- **Originating value:** the share of a product’s value that comes from the trade area, used in percentage-based origin tests.
- **Cumulation:** counting qualifying inputs or processing from another member country as if they were local.
- **Proof of origin:** the certificate or declaration presented to the importing customs authority to claim preference.
