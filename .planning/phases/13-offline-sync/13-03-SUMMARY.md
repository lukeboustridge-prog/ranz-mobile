---
phase: 13-offline-sync
plan: 03
subsystem: sync-reliability
tags: [retry-queue, hash-verification, evidence-integrity, exponential-backoff]

dependency-graph:
  requires:
    - 13-01 (background sync infrastructure)
    - 13-02 (sync custody events)
  provides:
    - Retry queue with max attempts and permanent failure marking
    - Post-sync hash verification for evidence integrity
    - Exponential backoff with jitter for retry delays
  affects:
    - Future sync failure handling
    - Evidence admissibility verification

tech-stack:
  added: []
  patterns:
    - Exponential backoff with jitter (base 1s, max 60s)
    - Post-sync verification using immutable originals
    - Fail-safe verification (never blocks sync)

file-tracking:
  key-files:
    created: []
    modified:
      - src/lib/sqlite.ts
      - src/services/evidence-service.ts
      - src/services/sync-service.ts

decisions:
  - id: retry-max-attempts
    choice: "MAX_SYNC_RETRY_ATTEMPTS = 5"
    reason: "Balance between giving failures a fair chance and not draining battery on permanently broken items"
  - id: permanent-failure-marking
    choice: "Append :permanently_failed to operation field"
    reason: "Preserves original operation while marking status, easily queryable"
  - id: verification-source
    choice: "Use original file in originals/ directory for hash verification"
    reason: "Immutable originals ensure verification against exact captured bytes"
  - id: verification-isolation
    choice: "Wrap verification in try/catch, never fail sync"
    reason: "Verification is audit trail, not blocking requirement"

metrics:
  duration: ~10 minutes
  completed: 2026-02-07
---

# Phase 13 Plan 03: Retry Queue and Hash Verification Summary

**One-liner:** Intelligent retry queue with exponential backoff and post-sync hash verification for evidence integrity audit trail.

## What Was Built

### 1. Retry Queue Management (sqlite.ts)

Added constants and functions for managing sync retry logic:

- `MAX_SYNC_RETRY_ATTEMPTS = 5` - Maximum retries before marking permanently failed
- `PERMANENTLY_FAILED_STATUS = 'permanently_failed'` - Status marker for items exceeding max retries
- `getRetryableItems()` - Get queue items with attemptCount < max (excludes permanently failed)
- `markPermanentlyFailed(id, error)` - Mark item as permanently failed after max retries
- `getFailedSyncCount()` - Count items that have permanently failed
- `resetFailedItems()` - Reset permanently failed items for manual retry

### 2. Post-Sync Hash Verification (evidence-service.ts)

Added `verifySyncedEvidence()` function that:

- Re-computes SHA-256 hash from original file in immutable `originals/` directory
- Compares with `originalHash` stored at capture time
- Logs VERIFIED custody event (pass/fail) via `logVerification()`
- Returns `{ isValid, currentHash, error? }` result
- Hash mismatches logged as errors but don't fail sync

### 3. Sync Service Integration (sync-service.ts)

Added exponential backoff and verification:

- `calculateBackoff(attemptCount)` - Exponential delay with jitter (1s base, 60s max)
- `handleSyncFailure(...)` - Track retries, mark permanently failed at max attempts
- Photo verification after upload success (using `originals/` directory)
- Video verification after upload success (both chunked and direct paths)
- All verification wrapped in try/catch for fail-safe operation

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add retry queue management functions to sqlite.ts | 881d97c | src/lib/sqlite.ts |
| 2 | Add post-sync hash verification to evidence-service.ts | d65b955 | src/services/evidence-service.ts |
| 3 | Integrate retry logic and hash verification into sync-service.ts | a7c99ba | src/services/sync-service.ts |

## Implementation Details

### Retry Queue Logic

```typescript
// Items retry up to 5 times
export const MAX_SYNC_RETRY_ATTEMPTS = 5;

// Get retryable items (excludes permanently failed)
export async function getRetryableItems(): Promise<LocalSyncQueue[]> {
  return database.getAllAsync(
    `SELECT * FROM sync_queue
     WHERE attempt_count < ?
       AND operation NOT LIKE ?`,
    [MAX_SYNC_RETRY_ATTEMPTS, '%:permanently_failed']
  );
}

// Mark as permanently failed after max attempts
export async function markPermanentlyFailed(id: number, error: string) {
  await database.runAsync(
    `UPDATE sync_queue
     SET last_error = ?,
         operation = operation || ':permanently_failed'
     WHERE id = ?`,
    [error, id]
  );
}
```

### Post-Sync Verification

```typescript
// Verify evidence after successful sync
if (photo.originalHash) {
  const originalUri = photo.localUri.replace('/photos/', '/evidence/originals/orig_');
  const verification = await verifySyncedEvidence(
    'photo',
    photoId,
    photo.originalHash,
    originalUri
  );
  if (!verification.isValid) {
    console.error(`[Sync] Photo ${photoId} failed post-sync verification`);
    // Logged but doesn't fail sync
  }
}
```

### Exponential Backoff

```typescript
private calculateBackoff(attemptCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute max
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
  const jitter = Math.random() * 500; // Up to 500ms jitter
  return exponentialDelay + jitter;
}
```

## Key Design Decisions

1. **MAX_SYNC_RETRY_ATTEMPTS = 5**: Provides reasonable retry window (up to ~31 seconds total backoff) without draining battery on permanently broken items

2. **Permanent failure marking via operation field**: Appending `:permanently_failed` to operation preserves original intent while enabling easy querying

3. **Verification from originals/ directory**: Uses immutable original file for hash verification, ensuring comparison against exact captured bytes

4. **Fail-safe verification**: All verification wrapped in try/catch to ensure verification failures never block sync operations

5. **Hash mismatch logging, not blocking**: Integrity failures are logged to chain of custody but don't fail the sync, maintaining audit trail while allowing sync to complete

## Verification

- [x] TypeScript compiles for all modified files (pre-existing type issues unrelated to changes)
- [x] MAX_SYNC_RETRY_ATTEMPTS = 5 exported from sqlite.ts
- [x] getRetryableItems returns items with attemptCount < MAX_SYNC_RETRY_ATTEMPTS
- [x] markPermanentlyFailed appends :permanently_failed to operation
- [x] verifySyncedEvidence logs VERIFIED custody event for all verifications
- [x] Photo upload verifies hash after sync (with originalUri from originals/)
- [x] Video upload verifies hash after sync (both chunked and direct paths)
- [x] calculateBackoff implements exponential delay with jitter

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Retry queue with max attempts ready for use
- Evidence integrity verified after every successful upload
- Chain of custody audit trail complete with VERIFIED events
- Ready for Plan 04: Sync Service Enhancements

---
*Phase: 13-offline-sync*
*Completed: 2026-02-07*
