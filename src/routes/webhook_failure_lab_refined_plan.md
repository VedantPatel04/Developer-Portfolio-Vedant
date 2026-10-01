# Webhook Failure Lab

## Refined Project Outline and Two-Week Engineering Roadmap

## 1. Product definition

Webhook Failure Lab is a production-minded developer platform for testing webhook consumers in **local and staging environments**. It captures valid webhook events, delivers them asynchronously, records every attempt, and reproduces duplicates, delays, retries, downtime, and out-of-order delivery.

It is not positioned as a production webhook gateway. The project demonstrates production engineering principles within deliberately limited traffic, availability, and data-handling boundaries.

## 2. Problem

Webhook handlers often pass ideal-path tests but fail when providers retry, send duplicates, deliver events out of order, or encounter an unavailable destination. These conditions are difficult to reproduce consistently and are usually discovered late.

## 3. Target users

- Developers building GitHub or generic webhook integrations
- Small engineering teams testing staging services
- QA engineers creating repeatable webhook regression tests
- Agencies debugging non-production client integrations

## 4. Core end-to-end workflow

1. A developer signs in with GitHub and creates a project.
2. The developer creates a webhook source and an HTTPS or local-CLI destination.
3. The platform generates an ingestion URL and source secret.
4. The provider sends an event to the ingestion Lambda.
5. Lambda validates size and quotas, verifies the signature against the exact raw body, and deduplicates by `(source_id, provider_delivery_id)`.
6. A database transaction stores the event and an outbox job before the platform returns `202 Accepted`.
7. The job is published to SQS; a scheduled reconciler republishes committed jobs if the first enqueue attempt fails.
8. A Lambda worker delivers the event to a public HTTPS destination or through the authenticated FastAPI/WebSocket relay to the local CLI.
9. PostgreSQL records the response, duration, error category, and every attempt.
10. SQS owns automatic retries and moves the job to a DLQ after five receives.
11. The dashboard shows the complete history. Manual replay creates a new traceable delivery rather than rewriting history.
12. The developer can execute or schedule a saved duplicate, delay, or reordering suite.

## 5. Two-week MVP scope

### Core

- GitHub OAuth through Supabase Auth
- Generic HMAC and GitHub webhook sources
- Signature verification using the unmodified request body
- Public HTTPS and local Python CLI destinations
- Durable event/outbox storage before acknowledgement
- SQS Standard delivery with a DLQ and five-attempt redrive policy
- Complete event and delivery-attempt history
- Manual replay linked to the original delivery
- Duplicate, delay, and controlled-reordering scenarios
- Saved suites and one-time or recurring suite execution
- Metadata search by project, source, event type, status, and time
- Usage enforcement, seven-day deletion, and a retained-payload budget
- Correlation IDs, structured logs, operational metrics, and a repeatable demo

### Stretch only

- Stripe sandbox source
- Payload-body search
- Team roles and invitations
- Advanced scenario scripting or payload transformations

## 6. Locked architecture

| Concern | Technology and responsibility |
| --- | --- |
| Web application | React + TypeScript; project setup, inspection, replay, suites, and history |
| Control API and relay | Python + FastAPI on one Render free web service; authenticated CRUD and WebSocket relay |
| Authentication | Supabase Auth with GitHub OAuth; FastAPI validates Supabase JWTs |
| Persistence | Supabase PostgreSQL; SQLAlchemy 2 + Alembic; Supavisor pooling for serverless connections |
| Ingestion | Python AWS Lambda Function URL; raw-body verification, idempotency, event/outbox transaction |
| Queueing | SQS Standard queue + DLQ; batch size one, visibility timeout, and the redrive policy own automatic retries |
| Delivery | Python Lambda worker; signed HTTPS delivery, bounded timeout, attempt recording |
| Recovery | Scheduled Lambda reconciles committed but unenqueued outbox jobs |
| Scenarios | Python orchestrator Lambda expands suites into delivery jobs with explicit release times |
| Scheduling | EventBridge Scheduler invokes suite runs and outbox reconciliation |
| Local delivery | Python CLI; short-lived relay token, WebSocket heartbeat, reconnect, and duplicate suppression |
| Infrastructure | AWS CDK in Python; separate development and demonstration stacks |
| Hosting | Render static site + free web service; Supabase Free plan |
| CI/CD | GitHub Actions for linting, tests, migrations, CDK checks, and deployments |

## 7. Core data model

- `Project`
- `Source` and encrypted `SourceSecret`
- `Destination`
- `Event`
- `OutboxJob`
- `Delivery`
- `DeliveryAttempt`
- `ScenarioSuite` and `SuiteRun`

Important uniqueness constraints include `(source_id, provider_delivery_id)`, `(delivery_id, attempt_number)`, and `(suite_id, scheduled_for)`.

## 8. Engineering invariants

- An event is acknowledged only after its event and outbox records commit.
- A committed outbox job is eventually enqueued by the initial request or reconciliation.
- GitHub uses `X-GitHub-Delivery`; generic sources must provide `X-Webhook-Id` for retry deduplication.
- Delivery is **at least once**. Downstream consumers remain responsible for idempotency.
- SQS visibility/redrive behavior, rather than application timers or an additional retry loop, owns the five-attempt lifecycle.
- Every attempt is append-only and traceable by event, delivery, suite run, and correlation ID.
- Manual replay creates a new delivery linked to the original.
- Scenario ordering is controlled by release times; it does not rely on SQS Standard ordering.
- Outgoing requests receive a fresh timestamped HMAC signature.
- Delivery follows no redirects and blocks literal, resolved, private, loopback, link-local, and reserved destination addresses.
- Tenant ownership is enforced on every API query; database constraints prevent cross-project references.
- Lambda concurrency and database pools are capped to protect PostgreSQL.

## 9. Operating boundaries

- Local and staging destinations only
- No production Stripe data
- 20 demonstration users
- 500 accepted events per user per month
- 10,000 accepted events globally per month
- 64 KB maximum request body
- Seven-day payload retention
- Five delivery attempts
- A hard retained-payload-byte budget protects the 500 MB Supabase Free database; ingestion returns `429` when either usage or storage admission limits are reached
- Expected AWS charge: `$0.00` at the published project limits, verified through usage telemetry and the existing `$0.01` budget alarm; this is a target, not a service guarantee
- Render may spin down or restart the free FastAPI service; CLI heartbeat and reconnect logic make this visible and recoverable, but the project provides no uptime guarantee
- No exactly-once claim, production SLA, arbitrary payload transformation, or verification of downstream database side effects

Current feasibility is supported by the published free allowances for [AWS Lambda](https://aws.amazon.com/lambda/pricing/), [Amazon SQS](https://aws.amazon.com/sqs/pricing/), and [EventBridge Scheduler](https://aws.amazon.com/eventbridge/pricing/). Supabase currently includes a 500 MB database per free project, while [Render explicitly positions free services for hobby/testing use and documents their idle and restart behavior](https://render.com/docs/free).

## 10. Scaling path, not MVP scope

- Move payload bodies to object storage while retaining searchable metadata in PostgreSQL.
- Move the control API and relay to always-on, horizontally scalable compute with a shared connection registry.
- Increase worker concurrency only alongside database capacity and connection-pool limits.
- Add stronger edge abuse protection, multi-region recovery, backups, and service-level objectives.

## 11. Verification strategy

| Level | Required proof |
| --- | --- |
| Unit | Provider verification, HMAC signing, URL/IP validation, quota logic, state transitions |
| Database | Migrations, tenant-scoped queries, uniqueness constraints, outbox transaction, retention |
| Integration | PostgreSQL + queue adapter, worker attempt writes, redrive/DLQ behavior, scheduler idempotency |
| End-to-end | Provider ingestion through staging and localhost delivery; failure, retry, DLQ, replay, and scenarios |
| Security | Invalid signatures, expired relay tokens, cross-tenant access, redirects, and SSRF address classes |
| Failure injection | Database failure, enqueue failure, worker crash, destination timeout, CLI disconnect/reconnect |
| Capacity | 10,000 small events with no unaccounted accepted event; separate 64 KB boundary and retained-byte tests |

## 12. Definition of done

The deployed demonstration proves:

1. Successful GitHub or generic ingestion and staging delivery
2. Signature rejection and duplicate ingestion handling
3. Destination failure, five SQS-controlled attempts, and DLQ isolation
4. Manual recovery with immutable prior history
5. Duplicate, delay, and controlled-reordering execution
6. Saved and scheduled suite execution without duplicate suite runs
7. Authenticated localhost forwarding, disconnect handling, and reconnection
8. Tenant isolation, SSRF defenses, retention, and quota enforcement
9. A capacity report, architecture decisions, operational runbook, and repeatable interview demo

---

# Two-Week Engineering Roadmap

## Sprint objective

Deliver one deployed, observable vertical slice first, then harden it into a defensible failure-testing platform. Reliability work takes priority over Stripe support or additional UI.

## Sprint 1 — Foundation and vertical slice

### 1. Contracts and failure model

**Build**

- Write the event, delivery, attempt, and suite-run state machines.
- Record short ADRs for the outbox boundary, idempotency keys, retry ownership, SQS Standard, and WebSocket relay.
- Define API contracts, database constraints, timeouts, quotas, and error categories.

**Exit criteria**

- Every failure point has an owner, persisted state, retry behavior, and terminal outcome.

### 2. Platform foundation

**Build**

- Create the React, FastAPI, Lambda, CLI, and CDK project structure.
- Configure GitHub Actions, Supabase GitHub OAuth, migrations, environment validation, and least-privilege AWS credentials.
- Deploy the static site, FastAPI service, PostgreSQL schema, Lambdas, queue, DLQ, and scheduler resources.

**Exit criteria**

- CI is green; a user can sign in; health checks and deployments work from a clean commit.

### 3. First end-to-end delivery

**Build**

- Implement generic HMAC ingestion, raw-body verification, event/outbox transaction, and deduplication.
- Publish job IDs to SQS and deliver them through Lambda to a controlled staging receiver.
- Persist attempts and expose one event-detail screen.

**Exit criteria**

- A real signed webhook appears in the dashboard with its successful response, duration, and correlation ID.

### Sprint 1 review

Demo the deployed happy path and one rejected signature. Do not begin stretch work if the vertical slice is not stable.

## Sprint 2 — Reliability, scenarios, and release

### 4. Reliability and security hardening

**Build**

- Add SQS redrive/DLQ behavior, bounded timeouts, append-only attempts, manual replay, and outbox reconciliation.
- Add GitHub verification, secret encryption, SSRF controls, tenant authorization, concurrency caps, quotas, and retention.
- Add structured logs and metrics for accepted events, queue age, success rate, retries, DLQ depth, and latency.

**Exit criteria**

- Forced enqueue failure is recovered; a failing destination reaches the DLQ after exactly five receives; replay succeeds without changing prior attempts.

### 5. Failure scenarios and scheduling

**Build**

- Implement duplicate, delay, and controlled-reordering plans as explicit delivery jobs.
- Save suites and run them manually or through EventBridge Scheduler.
- Make suite-run creation idempotent with `(suite_id, scheduled_for)`.

**Exit criteria**

- The same suite produces the expected delivery sequence and cannot create duplicate scheduled runs.

### 6. Local CLI relay

**Build**

- Add short-lived relay authentication, heartbeat, reconnect with backoff, local forwarding, and response return.
- Record CLI disconnects and timeouts as ordinary failed attempts; suppress duplicate local forwarding by delivery-attempt ID.

**Exit criteria**

- An event reaches localhost, the dashboard shows its response, and a disconnect/reconnect test behaves predictably.

### 7. QA, capacity, and interview handoff

**Build**

- Complete unit, database, integration, security, failure-injection, and Playwright smoke tests.
- Run a 10,000-small-event capacity test plus separate 64 KB and storage-admission boundary tests.
- Finish the README, architecture diagram, ADRs, cost evidence, runbook, known limitations, and a five-minute demo script.

**Exit criteria**

- No accepted event is unaccounted for; every delivery ends in success or DLQ.
- The full definition-of-done demo runs from a documented clean setup.
- Stripe remains deferred unless all core exit criteria pass.

## Sprint discipline

- Build in vertical slices: request -> persisted state -> queue -> worker -> visible result.
- Add the failure test in the same pull request as each capability.
- Require observable evidence before marking a story complete.
- Review scope at the Sprint 1 boundary; cut stretch work before cutting correctness or documentation.
