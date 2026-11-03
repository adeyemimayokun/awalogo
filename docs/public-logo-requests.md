# Public Logo Request Admission

Deployed public requests require `DATABASE_URL`, the abuse-limit migration
`neon/migrations/002_request_abuse.sql`, and `LOGO_REQUEST_ABUSE_SECRET`.
The secret must be a stable, server-only random value of at least 32 characters;
generate one with `openssl rand -base64 48`. Never prefix it with `VITE_` or
commit its value. Provision it independently in production and preview.
Missing configuration or an unavailable database fails closed before delivery.
Local development without a database uses an in-memory fallback.

Admission reserves a network budget (5/hour), recipient budget (3/day), and
global budget (100/day) atomically. Network and recipient identifiers are HMACs;
raw addresses are not stored in the abuse tables. Budget rows expire and
receipts expire after 30 days; persisted requests still prevent UUID reuse.

## Retry Flow

1. An accepted claim is pending while the handler persists the private request.
   Its initial durable `reply` is a non-NULL JSON storage-phase marker containing
   `leaseId` and `leaseUntil`, written atomically with admission. A hard process
   kill before persistence or before `beginDelivery` therefore leaves a leased,
   reclaimable claim, not a 30-day unqualified NULL reply. These JSON fields use
   the existing UPDATE(reply) grant; no additional timestamp column is needed.
   Concurrent authenticated retries return `409` with `Retry-After: 5`, an
   `error`, and the `trackingToken`. They do not report `ok` or send deliveries.
2. A storage failure before external delivery marks the receipt retryable.
   The response is `503` with an `error` and the token, including when the
   initial request omitted a token. Retry the same UUID, token, and form values.
   Reclaiming is atomic and retains the original quota reservation. Storage
   leases expire after one minute, allowing recovery even when an outage
   prevents recording the failure. An owner-checked transition to delivery
   prevents an expired/replaced handler from sending anything externally.
   Admission locks the receipt row with `SELECT ... FOR UPDATE` before reading
   its phase, serializing lease reclamation with the delivery transition even
   though that transition does not acquire the claims' advisory lock.
3. After external delivery starts, claims cannot be released: a timeout may
   conceal a successful email or GitHub write. If the delivery-phase receipt
   matches a persisted request UUID and tracking-token hash, retries return
   `202` with private tracking, `emailDelivered: false`, and
   `deliveryStatus: "unconfirmed"`. This confirms storage only; no email or
   issue is retried, and the delivery marker remains locked. Without matching
   durable storage it remains pending, never a successful replay. Old receipts
   with no recorded phase are also pending and need reconciliation: they may
   have delivered under the previous handler.
4. Completed retries require a matching UUID/token in the durable request
   table. The handler also verifies private tracking is available before
   replaying the saved success response. Missing/unavailable tracking is `503`.

Initial V1 requests may still omit `trackingToken`; the server generates it.
Successful bodies retain `ok`, `issue`, `emailDelivered`, and `trackingUrl`,
with the additive `trackingToken` field. A new UUID remains a new submission
and consumes fresh quotas, even if an older V1 client treats it as a retry.

Receipt state uses the existing `reply` column, so the runtime-role contract
remains SELECT/INSERT/DELETE and UPDATE(reply) on receipts, the existing budget
permissions, and EXECUTE on `claim_logo_request(uuid,text,text,text,text)`.
