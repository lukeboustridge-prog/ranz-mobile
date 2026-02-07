# Phase 13: Offline Sync - Research

**Researched:** 2026-02-07
**Domain:** Mobile offline-first synchronization, evidence integrity, background sync
**Confidence:** HIGH (existing implementation verified + official documentation)

## Summary

This phase focuses on making the RANZ mobile app work fully offline with reliable sync when connectivity is restored. The project already has substantial infrastructure in place:

- **Sync Engine** (`sync-service.ts`): Complete bidirectional sync with upload/download, conflict detection, progress callbacks
- **Background Sync** (`background-sync.ts`): Uses `expo-background-fetch` with TaskManager for background operations
- **Network Detection** (`useNetworkStatus.ts`): Polling-based network status with offline-to-online transition detection
- **Chunked Upload** (`chunked-upload.ts`): TUS protocol resumable uploads for large video files
- **Evidence Integrity** (`evidence-service.ts`, `chain-of-custody.ts`): SHA-256 hashing, append-only audit logging

The primary work for this phase is:
1. **Migration to `expo-background-task`**: Replace deprecated `expo-background-fetch` with the new API
2. **Sync reliability hardening**: Add retry queue with exponential backoff, idempotency keys
3. **Conflict resolution UI**: User-facing resolution for concurrent edits
4. **Photo-first sync ordering**: Prioritize evidence upload before metadata
5. **WiFi-only large file policy**: Enforce cellular/WiFi distinction for uploads

**Primary recommendation:** Migrate to `expo-background-task` (Expo SDK 53+), implement outbox pattern with idempotency keys, and add server-side "Last Write Wins" with manual override for evidence conflicts.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sqlite` | 16.0.10 | Local database | Expo-native SQLite with sync API |
| `@react-native-community/netinfo` | 11.4.1 | Network detection | Most reliable RN network library |
| `expo-background-fetch` | 14.0.9 | Background tasks | **DEPRECATED** - migrate to expo-background-task |
| `expo-task-manager` | 14.0.9 | Task coordination | Required for background task registration |
| `tus-js-client` | 4.3.1 | Resumable uploads | TUS protocol standard for large files |
| `axios` | 1.13.2 | HTTP client | Request/response interceptors, retry support |
| `expo-crypto` | 15.0.8 | SHA-256 hashing | Evidence integrity verification |
| `expo-secure-store` | 15.0.8 | Secure credentials | Auth tokens, device ID storage |

### New for This Phase
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-background-task` | SDK 53+ | Modern background sync | Replace expo-background-fetch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom sync | PowerSync/Turso | Higher complexity but built-in CRDT; project already has custom sync working |
| TUS protocol | S3 multipart | TUS is simpler, already implemented |
| SQLite queue | Async queue library | SQLite already the source of truth, no need for external queue |

**Installation:**
```bash
# No new packages needed - expo-background-task comes with Expo SDK 54
npx expo install expo-background-task  # When upgrading to SDK 53+
```

## Architecture Patterns

### Current Project Structure
```
src/
├── services/
│   ├── sync-service.ts        # Main sync engine (1500+ lines)
│   ├── background-sync.ts     # Background task registration
│   ├── evidence-service.ts    # SHA-256 hashing
│   └── chain-of-custody.ts    # Audit logging
├── hooks/
│   ├── useNetworkStatus.ts    # Network monitoring hook
│   ├── useSyncEngine.ts       # React hook for sync state
│   └── useSyncStatus.ts       # Sync status hook
├── lib/
│   ├── sqlite.ts              # Database operations
│   ├── api.ts                 # API client with retry
│   ├── chunked-upload.ts      # TUS resumable uploads
│   └── storage.ts             # Secure storage (tokens, settings)
└── types/
    ├── sync.ts                # Sync type definitions
    ├── database.ts            # Local DB types + schema
    └── shared.ts              # Shared backend/mobile types
```

### Pattern 1: Outbox Pattern for Reliable Sync
**What:** Write all mutations to local SQLite first, then push to server asynchronously
**When to use:** Always - this is the core offline-first pattern
**Example:**
```typescript
// Source: Existing sync-service.ts implementation
// 1. Save locally (immediate)
await saveReport(localReport);

// 2. Mark for sync (outbox)
const report = await getReport(id);
await saveReport({ ...report, syncStatus: 'pending' });

// 3. Background sync pushes to server
const pendingReports = await getPendingSyncReports();
// WHERE sync_status IN ('draft', 'pending', 'error')
```

### Pattern 2: Last Write Wins (LWW) with Conflict Detection
**What:** Server compares `clientUpdatedAt` vs `serverUpdatedAt`, newest wins
**When to use:** For report data where concurrent edits are rare
**Example:**
```typescript
// Source: Existing SyncUploadResponse type
interface ConflictResult {
  reportId: string;
  resolution: 'client_wins' | 'server_wins';
  serverUpdatedAt: string;
  clientUpdatedAt: string;
}

// Server-side resolution
if (clientUpdatedAt > serverUpdatedAt) {
  // Apply client changes
  resolution = 'client_wins';
} else {
  // Keep server version, flag for user review
  resolution = 'server_wins';
}
```

### Pattern 3: Exponential Backoff with Jitter
**What:** Retry failed uploads with increasing delays plus random jitter
**When to use:** All network operations
**Example:**
```typescript
// Source: Existing lib/api.ts withRetry function + chunked-upload.ts
const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000]; // TUS client

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const jitter = Math.random() * 500;
        const delay = baseDelay * Math.pow(2, attempt) + jitter;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
```

### Pattern 4: WiFi-Only for Large Files
**What:** Queue large uploads until WiFi is available
**When to use:** Files > 5MB (configurable)
**Example:**
```typescript
// Source: Existing sync-service.ts uploadPhotoToPresignedUrl
const syncSettings = await getSyncSettings();
if (syncSettings.photosWifiOnly) {
  const fileSizeMb = photo.fileSize / (1024 * 1024);
  if (fileSizeMb >= syncSettings.wifiOnlyThresholdMb) {
    const netState = await NetInfo.fetch();
    if (netState.type !== 'wifi') {
      console.log(`Photo queued for WiFi upload`);
      return false; // Keep as pending
    }
  }
}
```

### Anti-Patterns to Avoid
- **Syncing before local save:** Always persist locally first, sync is async side-effect
- **Blocking UI on sync:** Use background sync, never block user operations
- **Ignoring conflicts:** Always log conflicts, provide user resolution path
- **Retrying 4xx errors:** Only retry 5xx and network errors, not validation failures
- **Syncing without auth check:** Verify token before attempting sync
- **Modifying originals:** Evidence files in originals/ are immutable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resumable uploads | Custom chunk tracking | TUS protocol via `tus-js-client` | Handles resume URLs, chunk management, retries |
| Network detection | Native network polling | `@react-native-community/netinfo` | Cross-platform, reliable isInternetReachable |
| Background sync | Custom timers | `expo-background-task` | Uses native WorkManager/BGTaskScheduler |
| Secure storage | AsyncStorage | `expo-secure-store` | Encrypted, keychain-backed |
| Hash generation | Custom crypto | `expo-crypto` | Native implementation, SHA-256 standard |
| Queue persistence | In-memory queue | SQLite sync_queue table | Survives app restart, transaction-safe |

**Key insight:** The project already uses all the correct libraries. Focus on completing the implementation, not replacing infrastructure.

## Common Pitfalls

### Pitfall 1: Background Task Reliability
**What goes wrong:** Background tasks don't run when expected, especially on iOS
**Why it happens:** iOS aggressively limits background execution; swiping app away stops all tasks
**How to avoid:**
- Use `expo-background-task` (not deprecated expo-background-fetch)
- Set `minimumInterval` to at least 15 minutes
- Always have foreground sync as primary, background as optimization
- Test on physical devices (iOS Simulator doesn't support background tasks)
**Warning signs:** Sync only happens when app is foregrounded

### Pitfall 2: Upload Failure Loop
**What goes wrong:** Failed uploads retry infinitely, drain battery
**Why it happens:** No max retry limit, no error discrimination
**How to avoid:**
- Set MAX_RETRY_ATTEMPTS (currently 3 in sync-service.ts)
- Mark as `error` status after max attempts
- Only retry 5xx/network errors, not 4xx validation errors
- Provide manual retry option in UI
**Warning signs:** Battery drain complaints, sync stuck at 100% in logs

### Pitfall 3: Evidence Hash Mismatch After Sync
**What goes wrong:** Hash verification fails after photo is synced
**Why it happens:** Hash generated after file operations, not before
**How to avoid:**
- Generate hash from base64 IMMEDIATELY after capture (ev-01 decision)
- Never modify files in originals/ directory
- Use originalUri for verification, not localUri
- Log SYNCED custody event with hash for audit trail
**Warning signs:** `verifyIntegrity()` returns `isValid: false`

### Pitfall 4: Concurrent Sync Runs
**What goes wrong:** Multiple sync operations corrupt data or duplicate uploads
**Why it happens:** Auto-sync, back-online trigger, and manual sync all fire
**How to avoid:**
- Check `isSyncing` flag before starting (already in sync-service.ts)
- Use singleton SyncEngine pattern (already implemented)
- Queue sync requests rather than dropping them
**Warning signs:** Duplicate photos on server, "SYNC_IN_PROGRESS" errors

### Pitfall 5: Lost Offline Edits
**What goes wrong:** User edits offline, server overwrites when sync happens
**Why it happens:** Server-first sync strategy, no conflict detection
**How to avoid:**
- Upload local changes BEFORE downloading server updates (already correct order)
- Compare `clientUpdatedAt` vs `serverUpdatedAt` timestamps
- Flag conflicts in SyncUploadResponse for user resolution
- Never auto-delete local data without user confirmation
**Warning signs:** User reports "my changes disappeared"

### Pitfall 6: Cellular Data Drain
**What goes wrong:** Large files uploaded over cellular, unexpected data charges
**Why it happens:** No network type check, WiFi-only setting ignored
**How to avoid:**
- Implement photosWifiOnly setting (already in storage.ts)
- Check `netState.type === 'wifi'` before large uploads
- Queue large files with `syncStatus: 'wifi_pending'`
- Show data usage warning in UI
**Warning signs:** User complaints about mobile data usage

## Code Examples

Verified patterns from the existing codebase:

### Sync Engine Initialization
```typescript
// Source: src/services/sync-service.ts
import { syncEngine, initializeSyncEngine } from '../services/sync-service';

// Bootstrap on app start (in _layout.tsx or App.tsx)
const result = await initializeSyncEngine();
console.log(`Synced ${result.downloaded.checklists} checklists`);

// Start auto-sync after bootstrap
syncEngine.startAutoSync(5 * 60 * 1000); // 5 minutes
```

### Network-Triggered Sync
```typescript
// Source: src/hooks/useSyncEngine.ts
const { isConnected, wasOffline, clearWasOffline } = useNetworkStatus();

useEffect(() => {
  if (wasOffline && isConnected) {
    console.log('[Sync] Back online - triggering sync');
    sync();
    clearWasOffline();
  }
}, [wasOffline, isConnected]);
```

### Background Sync Registration
```typescript
// Source: src/services/background-sync.ts
// NOTE: Migrate to expo-background-task when updating to SDK 53+

// Define task at module level (before any component)
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const pendingReports = await getPendingSyncReports();
  if (pendingReports.length === 0) {
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const { syncPendingChanges } = await import('./sync-service');
  const result = await syncPendingChanges();

  return result.success
    ? BackgroundFetch.BackgroundFetchResult.NewData
    : BackgroundFetch.BackgroundFetchResult.Failed;
});
```

### Photo Upload with Evidence Logging
```typescript
// Source: Pattern combining evidence-service.ts + chain-of-custody.ts
import { logSync } from '../services/chain-of-custody';

async function uploadPhotoWithAudit(photo: LocalPhoto, uploadUrl: string) {
  // Upload binary
  const uploadResult = await FileSystem.uploadAsync(uploadUrl, photo.localUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': photo.mimeType },
    uploadType: FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadResult.status >= 200 && uploadResult.status < 300) {
    const publicUrl = uploadUrl.split('?')[0];
    await updatePhotoSyncStatus(photo.id, 'synced', publicUrl);

    // Log chain of custody event
    await logSync(
      'photo',
      photo.id,
      userId,
      userName,
      photo.originalHash,
      publicUrl
    );
  }
}
```

### Conflict Detection Response Handling
```typescript
// Source: src/types/shared.ts SyncUploadResponse
const response: SyncUploadResponse = await sendUploadPayload(payload);

for (const conflict of response.results.conflicts) {
  console.log(
    `Conflict for report ${conflict.reportId}: ${conflict.resolution} ` +
    `(server: ${conflict.serverUpdatedAt}, client: ${conflict.clientUpdatedAt})`
  );

  // Notify user of conflicts
  if (syncEngine.conflictCallback) {
    syncEngine.conflictCallback(response.results.conflicts);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `expo-background-fetch` | `expo-background-task` | Expo SDK 53 (late 2024) | More reliable, uses WorkManager/BGTaskScheduler |
| Polling network status | NetInfo event listener | Already using both | Event listener is primary, polling is backup |
| Direct multipart upload | TUS resumable protocol | Already implemented | Survives network interruption |
| Sync after download | Upload first, then download | Already correct | Prevents losing local changes |
| Global device ID | Per-report deviceId in JSON | ev-02 decision | Better chain of custody tracking |

**Deprecated/outdated:**
- `expo-background-fetch`: Being removed in upcoming Expo release, use `expo-background-task`
- `NetInfo.isConnected` only: Use `isInternetReachable` for true connectivity check
- `AsyncStorage` for tokens: Use `expo-secure-store` for sensitive data

## Open Questions

Things that couldn't be fully resolved:

1. **expo-background-task migration timing**
   - What we know: Expo SDK 53+ has the new API
   - What's unclear: Project is on SDK 54, need to verify if expo-background-task is included
   - Recommendation: Check `expo install expo-background-task`, update background-sync.ts to new API

2. **Conflict resolution UI design**
   - What we know: Server returns conflict list, callback exists
   - What's unclear: No UI mockups for user-facing conflict resolution
   - Recommendation: Design simple "Keep Mine / Keep Theirs / Merge" modal for report conflicts

3. **Video sync priority**
   - What we know: Videos use TUS chunked upload, currently synced after photos
   - What's unclear: Should video sync be deferred further given file sizes?
   - Recommendation: Add video-specific WiFi-only setting, separate from photo threshold

4. **Audit log sync**
   - What we know: Chain of custody logs to local audit_log table
   - What's unclear: Should audit log sync to server? Currently not in sync payload
   - Recommendation: Add audit log sync for court-admissible chain of custody

## Sources

### Primary (HIGH confidence)
- Expo Background Task documentation: https://docs.expo.dev/versions/latest/sdk/background-task/
- Expo Local-First Architecture: https://docs.expo.dev/guides/local-first/
- Existing codebase: `src/services/sync-service.ts`, `src/services/background-sync.ts`

### Secondary (MEDIUM confidence)
- TUS resumable upload protocol: https://tus.io/protocols/resumable-upload
- React Native NetInfo: https://github.com/react-native-netinfo/react-native-netinfo
- Expo SQLite Guide: https://medium.com/@aargon007/expo-sqlite-a-complete-guide-for-offline-first-react-native-apps-984fd50e3adb

### Tertiary (LOW confidence)
- Community patterns for offline-first: https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli
- Exponential backoff patterns: https://www.baeldung.com/resilience4j-backoff-jitter
- Conflict resolution strategies: https://medium.com/@therahulpahuja/5-critical-components-for-implementing-a-successful-offline-first-strategy-in-mobile-applications-849a6e1c5d57

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and working
- Architecture: HIGH - Patterns verified in existing codebase
- Pitfalls: HIGH - Based on existing implementation gaps and documented issues

**Research date:** 2026-02-07
**Valid until:** 60 days (stable domain, most changes are Expo SDK version-related)

---

## Implementation Priority Matrix

Based on research, the following items need implementation:

### Must Have (Phase 13 Core)
1. Migrate to `expo-background-task` API
2. Add idempotency keys to sync queue
3. Implement retry queue with max attempts
4. Verify evidence hash after sync completion
5. Add SYNCED custody event after successful photo upload

### Should Have (Reliability)
6. Conflict resolution UI modal
7. Video-specific WiFi-only setting
8. Sync progress notification (native)
9. Manual retry button for failed items
10. Audit log server sync

### Nice to Have (Polish)
11. Sync history screen
12. Data usage statistics
13. Per-report sync status indicator
14. Background sync toggle in settings
