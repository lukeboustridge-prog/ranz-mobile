---
phase: 13-offline-sync
plan: 01
subsystem: sync
tags: [expo-background-task, sqlite, idempotency, offline-sync, deduplication]

# Dependency graph
requires:
  - phase: 12-photo-management
    provides: Photo capture and evidence storage infrastructure
provides:
  - Modern background sync using expo-background-task (SDK 54+)
  - Idempotency keys for sync queue deduplication
  - Duplicate upload prevention via UNIQUE constraints
affects: [13-02, 13-03, sync-service, photo-upload]

# Tech tracking
tech-stack:
  added: [expo-background-task]
  patterns: [idempotency-key-generation, duplicate-rejection-via-constraint]

key-files:
  created: []
  modified:
    - src/services/background-sync.ts
    - src/types/database.ts
    - src/lib/sqlite.ts

key-decisions:
  - "[sync-01] expo-background-task uses minutes for minimumInterval, not seconds like expo-background-fetch"
  - "[sync-02] BackgroundTaskResult.Success used for no-data cases (API only has Success/Failed)"
  - "[sync-03] Idempotency key format: {entityType}:{entityId}:{operation}:{timestampMs}"
  - "[sync-04] addToSyncQueue returns boolean (true=added, false=duplicate) instead of throwing"

patterns-established:
  - "Idempotency keys: Generate using generateIdempotencyKey() before adding to queue"
  - "Duplicate handling: UNIQUE constraint silently rejects, function returns false"
  - "Background task: minimumInterval in minutes, only Success/Failed results"

# Metrics
duration: 15min
completed: 2026-02-07
---

# Phase 13 Plan 01: Background Sync Infrastructure Summary

**Migrated to expo-background-task SDK 54 API with idempotency key deduplication for sync queue items**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-07T10:00:00Z
- **Completed:** 2026-02-07T10:15:00Z
- **Tasks:** 3
- **Files modified:** 4 (including package.json)

## Accomplishments
- Migrated from deprecated expo-background-fetch to expo-background-task
- Added idempotency_key column to sync_queue with UNIQUE constraint
- Implemented generateIdempotencyKey() and checkIdempotencyKey() functions
- Updated addToSyncQueue() to return boolean for duplicate detection
- Added database migration v11 for existing databases

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate background-sync.ts to expo-background-task** - `da77292` (feat)
2. **Task 2: Add idempotency_key column to sync_queue schema** - `37aed35` (feat)
3. **Task 3: Update sqlite.ts with idempotency key functions** - `4e77f0a` (feat)

## Files Created/Modified
- `src/services/background-sync.ts` - Updated to use expo-background-task API with BackgroundTask.* namespace
- `src/types/database.ts` - Added idempotencyKey to LocalSyncQueue, UNIQUE column, migration v11
- `src/lib/sqlite.ts` - Added generateIdempotencyKey(), checkIdempotencyKey(), updated addToSyncQueue()
- `package.json` - Added expo-background-task dependency

## Decisions Made
- **expo-background-task API differences:** The new API uses BackgroundTaskResult.Success/Failed only (no NoData/NewData), BackgroundTaskStatus.Available/Restricted only (no Denied), and minimumInterval in minutes not seconds
- **Idempotency key format:** Using `{entityType}:{entityId}:{operation}:{timestampMs}` for unique identification
- **Duplicate handling:** Returns false instead of throwing exception for cleaner API consumption
- **Migration backfill:** Existing sync_queue rows get idempotency keys derived from their existing data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed expo-background-task package**
- **Found during:** Task 1 (migration to expo-background-task)
- **Issue:** expo-background-task was not installed - package.json only had expo-background-fetch
- **Fix:** Ran `npx expo install expo-background-task` to add SDK 54 compatible version
- **Files modified:** package.json, package-lock.json
- **Verification:** Import succeeds, TypeScript recognizes BackgroundTask namespace
- **Committed in:** da77292 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed API usage for expo-background-task**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** expo-background-task has different enum values than expo-background-fetch (no NoData/NewData, no Denied status, different options)
- **Fix:** Updated all references to use correct enum values (Success/Failed, Available/Restricted) and options (minimumInterval only, no stopOnTerminate/startOnBoot)
- **Files modified:** src/services/background-sync.ts
- **Verification:** TypeScript compiles without errors in target file
- **Committed in:** da77292 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correct compilation. Package install was implicit in plan instructions.

## Issues Encountered
- expo-background-task API differs significantly from expo-background-fetch - required reviewing actual TypeScript definitions to understand correct usage
- Existing unrelated TypeScript errors in other files (PreSubmitChecklist.tsx, ReviewCommentsPanel.tsx) - these predate this plan and are not blockers

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Background sync infrastructure ready for 13-02 (sync custody events)
- Idempotency keys enable safe retry logic in sync service
- Database schema ready for new sync queue items with deduplication

---
*Phase: 13-offline-sync*
*Completed: 2026-02-07*
