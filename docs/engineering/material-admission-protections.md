# Course material admission protections

## Defaults

The server admits at most **5 new materials per authenticated user per UTC day**, with at most **50 MiB (52,428,800 bytes) combined** across PDFs and pasted notes. The existing 10 MiB per-PDF, 120-page, 100,000-character notes, and 500,000-character extracted-text limits remain unchanged. PDF usage is the exact uploaded byte size; notes usage is their UTF-8 encoded byte length. A material is counted once it has been safely stored and its material record has been created; later processing failures do not refund an accepted upload.

Each material allows **2 manual processing retries** after its initial queueing. Queue-level automatic retries remain separately bounded by the existing three-retry policy. A failed enqueue rolls back the manual retry counter when the item is still queued and the worker has not claimed it.

The values are configurable server-side with `COURSE_MATERIAL_DAILY_COUNT_LIMIT`, `COURSE_MATERIAL_DAILY_BYTES_LIMIT`, and `COURSE_MATERIAL_MANUAL_RETRY_LIMIT`. The defaults are conservative launch starting points, not a permanent product promise. Notes count toward both the daily item count and aggregate bytes.

## Atomic admission lifecycle

Migration `0013_course_material_admission_limits.sql` adds a private admission ledger and `manual_retry_count`. A trusted server request reserves a pending admission through a PostgreSQL function. A transaction-scoped advisory lock serializes per-user UTC-day count and byte checks across concurrent web instances. Pending reservations are included in the quota calculation so simultaneous uploads cannot overbook; a reservation is finalized only after storage/material persistence succeeds. Failed attempts release the pending row. If the process crashes, the pending row expires after 30 minutes and is removed during the next admission attempt. Only finalized records consume the daily allowance. Admission functions/table have no browser-role grants; they are called using the trusted server `DATABASE_URL` connection.

PDF and notes actions validate the signed-in owner and course before reserving. Existing file validation, private Storage paths, owner-scoped row writes, and safe user-facing errors remain in force. The database enforces manual retry count atomically in the same conditional update that moves an owned failed material back to queued.

The migration is source-only until separately validated and approved for a named database. Do not apply it to an existing local or hosted database as part of this change. New code fails closed if the admission RPC/schema is unavailable; apply and verify migration 0013 before enabling these actions in an environment.

## Verification boundaries

Focused unit tests cover configured defaults, safe denial/failure mapping, UTC-day selection and expiry invariants in the migration source, serialized reservation ordering, owner-scoped finalization/release, and the conditional manual-retry update. They do not replace disposable PostgreSQL validation of the migration's actual concurrency and role behavior. Do not claim database validation until a separate disposable-database run succeeds.
