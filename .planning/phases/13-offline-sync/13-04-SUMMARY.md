---
phase: 13-offline-sync
plan: 04
subsystem: sync-ui
tags: [conflict-resolution, sync-status, retry, react-native, ui-components]

dependency-graph:
  requires: [13-03]
  provides: [sync-conflict-modal, sync-status-bar, conflict-resolution-hooks]
  affects: [13-05]

tech-stack:
  patterns: [modal-presentation, status-bar-component, callback-registration]

key-files:
  created:
    - src/components/ConflictModal.tsx
    - src/components/SyncStatusBar.tsx
  modified:
    - src/hooks/useSyncEngine.ts
    - src/components/index.ts

decisions:
  - id: ui-01
    description: "Use pageSheet presentation for conflict modal (iOS-style bottom sheet)"
  - id: ui-02
    description: "Failed badge is tappable to trigger retry (single-tap UX)"
  - id: ui-03
    description: "Conflict resolution logs but does not send to server yet (TODO for future phase)"

metrics:
  duration: ~15min
  completed: 2026-02-07
---

# Phase 13 Plan 04: Sync Service Enhancements Summary

Conflict resolution UI and manual retry functionality for sync operations implemented.

## One-liner

ConflictModal for resolving concurrent edits with SyncStatusBar showing pending/failed counts and retry button

## What Was Built

### Task 1: ConflictModal Component
Created `src/components/ConflictModal.tsx`:
- `SyncConflict` interface: reportId, reportNumber, resolution, serverUpdatedAt, clientUpdatedAt
- `ConflictResolution` type: 'keep_local', 'keep_server', 'dismiss'
- Modal with pageSheet presentation style
- Conflict list with "Keep Mine" and "Keep Server" buttons
- "Dismiss All (Decide Later)" footer button
- Relative timestamp formatting (Just now, Xm ago, Xh ago)
- Uses RANZ theme colors (primary blue, accent orange for conflict border)

### Task 2: SyncStatusBar Component
Created `src/components/SyncStatusBar.tsx`:
- Online/offline status indicator with colored dot
- Pending count badge (blue background)
- Failed count badge (red background, tappable for retry)
- "Sync Now" button (disabled when nothing pending)
- Last sync time with relative formatting
- Offline state shows red background

### Task 3: useSyncEngine Hook Updates
Modified `src/hooks/useSyncEngine.ts`:
- Added `conflicts` and `showConflictModal` state
- Added `failedCount` state
- Registered conflict callback on sync engine
- Added `loadFailedCount()` helper using `getFailedSyncCount()`
- Added `retryFailed()` function: resets failed items then syncs
- Added `resolveConflict()` and `dismissConflicts()` handlers
- Updated return value with all new state and functions

### Component Exports
Updated `src/components/index.ts`:
- Added exports for ConflictModal, SyncConflict, ConflictResolution
- Added export for SyncStatusBar

## Code Patterns

### Conflict Callback Registration
```typescript
syncEngine.onConflict((serverConflicts) => {
  const formatted: SyncConflict[] = serverConflicts.map((c) => ({
    reportId: c.reportId,
    reportNumber: "",
    resolution: c.resolution as "client_wins" | "server_wins" | "pending",
    serverUpdatedAt: (c as Record<string, unknown>).serverUpdatedAt || new Date().toISOString(),
    clientUpdatedAt: (c as Record<string, unknown>).clientUpdatedAt || new Date().toISOString(),
  }));
  setConflicts(formatted);
  if (formatted.length > 0) {
    setShowConflictModal(true);
  }
});
```

### Retry Failed Handler
```typescript
const retryFailed = useCallback(async () => {
  await resetFailedItems();       // Reset in database
  const result = await retryFailedSyncs();  // Re-sync
  setLastResult(result);
  await loadSyncState();          // Reload counts
}, [loadSyncState]);
```

## Integration Points

| Component | Hook Property | Usage |
|-----------|--------------|-------|
| ConflictModal | conflicts, showConflictModal, resolveConflict, dismissConflicts | Display and resolve conflicts |
| SyncStatusBar | syncState.pendingUploads, failedCount, retryFailed, sync | Display status and trigger actions |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Commit | Description |
|--------|-------------|
| 7957ff4 | feat(13-04): create ConflictModal component for sync conflicts |
| 25b5ae0 | feat(13-04): create SyncStatusBar component for sync status display |
| d17b9f5 | feat(13-04): add conflict and retry state to useSyncEngine hook |

## Verification

1. TypeScript compilation succeeds for all files - PASS
2. ConflictModal renders conflict list with resolution buttons - PASS
3. SyncStatusBar shows online/offline, pending, failed counts - PASS
4. useSyncEngine returns conflicts array and resolution functions - PASS
5. retryFailed resets failed items and triggers sync - PASS
6. Failed badge in SyncStatusBar is tappable - PASS

## Next Phase Readiness

Plan 13-05 (Verification Checkpoint) can proceed:
- All sync UI components are complete
- Conflict resolution flow is ready for testing
- Retry functionality integrated with retry queue from 13-03
- Components exported and ready for integration into app screens

### Remaining for Future Phases
- Actually send conflict resolution to server (currently logs only)
- Populate reportNumber in conflict from report data
- Add visual diff view for conflicts (View Differences option)
