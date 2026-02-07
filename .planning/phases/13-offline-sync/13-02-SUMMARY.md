---
phase: 13-offline-sync
plan: 02
subsystem: evidence-integrity
tags: [chain-of-custody, sync, audit-trail, legal-compliance]

dependency-graph:
  requires:
    - 13-01 (chain-of-custody service foundation)
  provides:
    - SYNCED custody events for all evidence uploads
    - Complete audit trail for evidence synchronization
  affects:
    - Any future evidence upload paths
    - Legal admissibility of synced evidence

tech-stack:
  added: []
  patterns:
    - Try/catch isolation for non-critical logging
    - Fail-safe custody logging (never blocks sync)

file-tracking:
  key-files:
    created: []
    modified:
      - src/services/sync-service.ts

decisions:
  - id: custody-isolation
    choice: "Wrap all custody logging in try/catch"
    reason: "Custody logging failures must never prevent successful sync"
    alternatives: ["Let errors propagate", "Queue failed custody logs"]

metrics:
  duration: ~2 minutes
  completed: 2026-02-07
---

# Phase 13 Plan 02: Sync Custody Events Summary

**One-liner:** Wire SYNCED custody events into sync service for evidence audit trail on photos, videos, and voice notes.

## What Was Built

Integrated chain-of-custody SYNCED event logging into the sync service for all evidence types. Every successful evidence upload now records a custody event including:

- Entity type (photo, video, voice_note)
- Entity ID
- User ID and name performing the sync
- Original hash at capture time (for verification)
- Server URL where evidence was uploaded

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add chain-of-custody import and getCurrentUser helper | 8a96167 | src/services/sync-service.ts |
| 2 | Add SYNCED custody events to photo, video, and voice note uploads | 69422ac | src/services/sync-service.ts |

## Implementation Details

### Task 1: Import and Helper Method

Added import of `logSync` (aliased as `logCustodySync` to avoid naming conflicts) from the chain-of-custody service, and created a private `getCurrentUser()` helper method in the SyncEngine class.

```typescript
import { logSync as logCustodySync } from "./chain-of-custody";

private async getCurrentUser(): Promise<{ userId: string; userName: string }> {
  try {
    const user = await getUser();
    if (user) {
      return { userId: user.id, userName: user.name };
    }
  } catch (error) {
    console.warn('[Sync] Could not get user for custody logging:', error);
  }
  return { userId: 'system', userName: 'System Sync' };
}
```

### Task 2: SYNCED Events for Evidence Uploads

Added custody logging in four locations:

1. **Photo upload success** (uploadPhotoToPresignedUrl method)
2. **Video TUS upload success** (uploadVideo method - chunked upload path)
3. **Video direct upload success** (uploadVideo method - presigned URL path)
4. **Voice note upload success** (uploadVoiceNote method)

Each custody call follows this pattern:

```typescript
try {
  const { userId, userName } = await this.getCurrentUser();
  await logCustodySync(
    "photo",           // entity type
    photoId,           // entity ID
    userId,            // user performing sync
    userName,          // user display name
    photo.originalHash || "",  // hash from capture
    publicUrl          // server URL
  );
  console.log(`[Sync] Logged SYNCED custody event for photo ${photoId}`);
} catch (custodyError) {
  // Don't fail the upload if custody logging fails
  console.warn(`[Sync] Failed to log custody event for photo ${photoId}:`, custodyError);
}
```

## Key Design Decisions

1. **Try/catch isolation**: All custody logging is wrapped in try/catch to ensure custody logging failures never prevent successful sync operations
2. **Alias import**: `logSync` renamed to `logCustodySync` to avoid confusion with sync service logging
3. **Fallback user**: If user cannot be retrieved, falls back to "system" user for audit continuity
4. **Hash at sync time**: Uses the original hash captured at creation, not re-computed at sync time

## Verification

- [x] TypeScript compiles without new errors
- [x] logCustodySync imported from chain-of-custody.ts (line 61)
- [x] getCurrentUser method exists in SyncEngine class (line 136)
- [x] Photo upload success path calls logCustodySync with "photo" (line 873)
- [x] Video TUS upload success calls logCustodySync with "video" (line 948)
- [x] Video direct upload success calls logCustodySync with "video" (line 1001)
- [x] Voice note upload success calls logCustodySync with "voice_note" (line 1081)
- [x] All custody calls wrapped in try/catch

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

- Chain of custody events now logged for all evidence uploads
- Audit trail complete for legal admissibility requirements
- Ready for Plan 03: Conflict Resolution
