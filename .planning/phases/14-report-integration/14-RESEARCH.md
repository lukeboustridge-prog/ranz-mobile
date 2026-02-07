# Phase 14: Report Integration - Research

**Researched:** 2026-02-07
**Domain:** Mobile-to-Web photo sync, report builder integration, evidence chain of custody
**Confidence:** HIGH (existing implementation verified in both codebases)

## Summary

This phase focuses on completing the integration between the mobile app's photo capture and the web platform's report builder. The primary discovery is that **substantial infrastructure already exists on both sides** - the sync endpoints, presigned URLs, photo processing, and audit logging are all implemented. The remaining work is primarily:

1. **Completing photo URL updates** after binary upload to presigned URLs
2. **Ensuring audit log sync** for court-admissible chain of custody
3. **Adding real-time sync status feedback** in the web report builder
4. **Verifying evidence integrity** end-to-end

**Key finding:** The `/api/sync/upload` endpoint already handles reports, elements, defects, compliance, and photo metadata. Photos are uploaded separately to presigned URLs (R2 or local fallback). The main gap is that photo records in the web DB have empty URLs until the binary is uploaded - the photo metadata sync creates placeholder records, but there's no mechanism to update the URL after the presigned upload completes.

**Primary recommendation:** Add a `/api/photos/[id]/confirm-upload` endpoint for the mobile app to call after successful presigned URL upload, which updates the photo's URL and triggers thumbnail generation server-side.

## Existing Infrastructure Summary

### Web App API Endpoints (Already Implemented)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/sync/bootstrap` | GET | Download user, checklists, templates, reports | COMPLETE |
| `/api/sync/upload` | POST | Upload reports with nested elements, defects, compliance, photo metadata | COMPLETE |
| `/api/photos` | POST | Direct photo upload (multipart form) | COMPLETE |
| `/api/photos/direct-upload` | PUT/POST | Local dev fallback for presigned URLs | COMPLETE |
| `/api/photos/[id]` | GET/PUT/DELETE | CRUD for photos | COMPLETE |
| `/api/photos/[id]/verify` | POST | Hash verification | COMPLETE |
| `/api/reports/[id]` | GET/PUT | Report CRUD | COMPLETE |
| `/api/reports/[id]/audit-log` | GET | Audit trail | COMPLETE |
| `/api/health` | GET | Health check | COMPLETE |

### Mobile App Sync Infrastructure (Already Implemented)

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| Sync Engine | `sync-service.ts` | Bidirectional sync with progress callbacks | COMPLETE |
| Background Sync | `background-sync.ts` | Task registration for offline sync | COMPLETE |
| API Client | `lib/api.ts` | Axios with auth interceptors, retry logic | COMPLETE |
| Chain of Custody | `chain-of-custody.ts` | SYNCED event logging | COMPLETE |
| Evidence Service | `evidence-service.ts` | SHA-256 hashing, verification | COMPLETE |
| Chunked Upload | `chunked-upload.ts` | TUS protocol for large videos | COMPLETE |

### Database Schema (Prisma)

Photos have all required fields for mobile integration:
- `originalHash` - SHA-256 from mobile capture
- `hashVerified` - Set to true after server verification
- `capturedAt`, `gpsLat`, `gpsLng` - From EXIF
- `cameraMake`, `cameraModel` - For evidence chain
- `url`, `thumbnailUrl` - Cloud storage URLs

## Gap Analysis

### Gap 1: Photo URL Completion (CRITICAL)

**Problem:** The sync upload creates photo records with empty URLs, expecting binary upload via presigned URL. But there's no mechanism to update the photo record after successful upload.

**Current Flow:**
1. Mobile calls `/api/sync/upload` with photo metadata
2. Server creates Photo record with `url: ""` and returns `pendingPhotoUploads[]` with presigned URLs
3. Mobile uploads binary to presigned URL
4. Mobile updates local `syncStatus: 'synced'` and stores `remoteUrl`
5. **GAP:** Server photo record still has empty URL

**Solution:** Add confirmation endpoint or webhook to update photo URL after upload.

### Gap 2: Audit Log Server Sync (MEDIUM)

**Problem:** Chain of custody events (CAPTURED, HASHED, STORED, SYNCED) are logged to mobile SQLite but never synced to the web server.

**Current Flow:**
1. Mobile logs custody events to local `audit_log` table
2. Sync uploads report data but NOT audit logs
3. Server has its own `AuditLog` model but no custody events from mobile

**Solution:** Add audit log sync to the upload payload, or sync custody chain separately.

### Gap 3: Real-time Sync Status (LOW)

**Problem:** Web report builder doesn't show which photos are pending sync from mobile.

**Current:** Photos appear immediately in report builder once metadata is synced, but with no image (empty URL).

**Solution:** Add sync status indicator to Photo model or use `hashVerified` as proxy.

### Gap 4: Thumbnail Generation for Mobile Photos (MEDIUM)

**Problem:** Mobile uploads raw photo to presigned URL, but web report builder expects thumbnails.

**Current Flow:**
1. Web's `/api/photos` route uses `processPhoto()` to generate thumbnails
2. Presigned URL upload bypasses this processing

**Solution:** Either:
- Mobile generates thumbnails locally (increases complexity)
- Server processes photos after upload confirmation
- Use on-demand thumbnail service (Cloudflare Image Resizing)

## Standard Stack

### Core (Already Installed - Web)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | 3.x | R2/S3 operations | AWS-compatible API |
| `@aws-sdk/s3-request-presigner` | 3.x | Presigned URLs | Secure direct uploads |
| `sharp` | 0.33.x | Image processing | EXIF extraction, thumbnails |
| `prisma` | 7.3.x | ORM | Type-safe database access |

### Core (Already Installed - Mobile)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-file-system` | 18.x | File operations | Binary upload to presigned URLs |
| `expo-crypto` | 15.x | SHA-256 hashing | Evidence integrity |
| `axios` | 1.13.x | HTTP client | Request interceptors, retry |
| `tus-js-client` | 4.3.x | Resumable uploads | Large video files |

### No New Libraries Needed

The existing stack handles all requirements. The gaps are in implementation, not tooling.

## Architecture Patterns

### Pattern 1: Two-Phase Photo Sync

**What:** Separate metadata sync from binary upload
**When to use:** Always - reduces payload size, enables presigned URL security
**Already Implemented:** Yes, in `/api/sync/upload`

```typescript
// Phase 1: Metadata sync (in sync upload payload)
interface PhotoMetadataSync {
  id: string;
  photoType: PhotoType;
  filename: string;
  originalHash: string;  // Critical for evidence
  capturedAt: string | null;
  gpsLat: number | null;
  needsUpload: boolean;  // True if binary needs upload
}

// Phase 2: Binary upload (to presigned URL)
const uploadResult = await FileSystem.uploadAsync(
  presignedUrl,
  photo.localUri,
  { httpMethod: 'PUT', headers: { 'Content-Type': photo.mimeType } }
);

// Missing Phase 3: Confirm upload
await apiClient.post(`/api/photos/${photoId}/confirm-upload`, {
  publicUrl: presignedUrl.split('?')[0]
});
```

### Pattern 2: Chain of Custody Sync

**What:** Sync local custody events to server audit log
**When to use:** For court-admissible evidence trail

```typescript
// Source: Add to sync upload payload
interface SyncUploadPayload {
  reports: ReportSync[];
  deviceId: string;
  syncTimestamp: string;
  // NEW: Custody events
  custodyEvents?: CustodyEventSync[];
}

interface CustodyEventSync {
  entityType: 'photo' | 'video' | 'voice_note';
  entityId: string;
  action: CustodyAction;
  timestamp: string;
  deviceId: string;
  hashAtTime: string | null;
  details?: string;
}
```

### Pattern 3: Photo Existence Verification

**What:** Check if photo binary exists before displaying in report builder
**When to use:** When displaying synced photos

```typescript
// Web report builder should check photo.url before rendering
const photoIsReady = photo.url && photo.url !== '';

// Or use hashVerified as proxy (set after binary confirmed)
const photoIsVerified = photo.hashVerified;
```

### Anti-Patterns to Avoid

- **Waiting for binary upload in sync:** Sync should return fast with presigned URLs, binary uploads are async
- **Modifying evidence after sync:** Photos in originals/ are immutable, hash must match
- **Skipping hash verification:** Always verify hash on server after upload
- **Ignoring custody chain:** All evidence access must be logged for court admissibility

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image thumbnails | Custom resize | Sharp (server) or Cloudflare Image Resizing | Edge cases, memory management |
| Presigned URLs | Custom signing | `@aws-sdk/s3-request-presigner` | Security, expiration handling |
| Hash verification | Manual comparison | Existing `processPhoto()` + `originalHash` field | Already implemented |
| Retry logic | setTimeout loops | Existing `withRetry()` with exponential backoff | Jitter, max attempts |

## Common Pitfalls

### Pitfall 1: Empty Photo URLs in Report Builder

**What goes wrong:** Photos appear in report builder but images don't load
**Why it happens:** Metadata synced, binary upload still pending or URL not updated
**How to avoid:**
- Add `syncStatus` or `uploadComplete` field to Photo model
- Check `photo.url !== ''` before rendering image
- Show placeholder for photos pending binary upload
**Warning signs:** Broken image icons in report builder

### Pitfall 2: Hash Mismatch After Upload

**What goes wrong:** Server hash verification fails after presigned URL upload
**Why it happens:** Hash computed on different file content, or file corrupted in transit
**How to avoid:**
- Mobile computes hash BEFORE any file operations (already done)
- Server re-computes hash after download and compares to originalHash
- Use `hashVerified` field to track verification status
**Warning signs:** `hashVerified: false` in database

### Pitfall 3: Missing Custody Events

**What goes wrong:** Court challenges evidence because chain of custody incomplete
**Why it happens:** Custody events only in mobile SQLite, not synced to server
**How to avoid:**
- Add custody event sync to upload payload
- Log SYNCED event on both mobile AND server
- Ensure timestamps are preserved, not overwritten
**Warning signs:** Audit log on server only shows web-side events

### Pitfall 4: Duplicate Photo Uploads

**What goes wrong:** Same photo uploaded multiple times, duplicates in report
**Why it happens:** Mobile retries upload but doesn't check if already exists
**How to avoid:**
- Use idempotency key (photo.id) for uploads
- Server checks if photo URL already populated before accepting upload
- Update existing record, don't create duplicate
**Warning signs:** Multiple photos with same originalHash in report

## Code Examples

### Confirm Photo Upload (New Endpoint)

```typescript
// POST /api/photos/[id]/confirm-upload
// Call after successful presigned URL upload

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();

  const { publicUrl } = await request.json();

  const photo = await prisma.photo.findUnique({
    where: { id: params.id },
    include: { report: true }
  });

  if (!photo || photo.report.inspectorId !== authUser.userId) {
    return notFound();
  }

  // Generate thumbnail server-side
  const response = await fetch(publicUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const { thumbnail } = await processPhoto(buffer);

  const thumbnailKey = generateThumbnailKey(photo.filename);
  const thumbnailUrl = await uploadToR2(thumbnail, thumbnailKey, 'image/jpeg');

  // Update photo record
  await prisma.photo.update({
    where: { id: params.id },
    data: {
      url: publicUrl,
      thumbnailUrl,
      hashVerified: true,
      uploadedAt: new Date(),
    }
  });

  // Add audit log
  await prisma.auditLog.create({
    data: {
      reportId: photo.reportId,
      userId: authUser.userId,
      action: 'PHOTO_UPLOADED',
      details: {
        photoId: photo.id,
        source: 'mobile_sync',
        originalHash: photo.originalHash,
      }
    }
  });

  return NextResponse.json({ success: true });
}
```

### Mobile Upload Completion Handler

```typescript
// In sync-service.ts, after successful presigned URL upload

private async confirmPhotoUpload(photoId: string, uploadUrl: string): Promise<void> {
  const publicUrl = uploadUrl.split('?')[0];

  try {
    await apiClient.post(`/api/photos/${photoId}/confirm-upload`, {
      publicUrl
    });

    console.log(`[Sync] Photo ${photoId} upload confirmed with server`);
  } catch (error) {
    console.error(`[Sync] Failed to confirm upload for ${photoId}:`, error);
    // Don't fail the sync - server can poll for unconfirmed photos
    throw error;
  }
}
```

### Custody Event Sync

```typescript
// Add to sync upload payload builder

private async buildCustodyEventsForSync(
  photoIds: string[]
): Promise<CustodyEventSync[]> {
  const events: CustodyEventSync[] = [];

  for (const photoId of photoIds) {
    const custodyChain = await getCustodyChain('photo', photoId);

    for (const event of custodyChain) {
      events.push({
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        timestamp: event.timestamp,
        deviceId: event.deviceId,
        hashAtTime: event.hashAtTime,
        details: event.details,
      });
    }
  }

  return events;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multipart form upload | Presigned URL direct upload | Already implemented | Faster, more scalable |
| Server-generated hash | Mobile-generated hash at capture | Already implemented | Captures true original |
| Sync after upload | Sync metadata, then upload binary | Already implemented | Faster sync, offline support |
| Single audit log | Chain of custody with deviceId | Already implemented | Court-admissible evidence |

## Open Questions

1. **Thumbnail generation location**
   - What we know: Web currently generates thumbnails, mobile uploads raw
   - What's unclear: Should mobile pre-generate thumbnails? Performance impact?
   - Recommendation: Server-side generation after upload confirmation (simpler)

2. **Audit log sync granularity**
   - What we know: Mobile logs detailed custody events
   - What's unclear: Sync all events, or just key events (CAPTURED, SYNCED)?
   - Recommendation: Sync all events initially, can optimize later if needed

3. **Photo sync ordering**
   - What we know: Photos upload in parallel for speed
   - What's unclear: Should photos have specific order in report?
   - Recommendation: Use `sortOrder` field, preserve capture order

## Implementation Recommendations

### Priority 1: Photo URL Completion (This Phase)
1. Add `/api/photos/[id]/confirm-upload` endpoint
2. Update mobile `uploadPhotoToPresignedUrl` to call confirmation
3. Add `uploadedAt` timestamp to Photo model
4. Handle confirmation failure gracefully

### Priority 2: Evidence Integrity (This Phase)
1. Server-side hash verification after upload confirmation
2. Set `hashVerified: true` only after hash matches
3. Log verification result to audit log

### Priority 3: Custody Chain Sync (This Phase)
1. Add custody events to sync upload payload schema
2. Server maps custody events to AuditLog entries
3. Preserve original timestamps from mobile

### Priority 4: Report Builder Integration (This Phase)
1. Photo gallery shows sync status indicator
2. Empty URL photos show "pending sync" state
3. Evidence integrity summary in report audit view

## Sources

### Primary (HIGH confidence)
- Web app codebase: `/api/sync/upload/route.ts`, `/api/photos/route.ts`
- Mobile app codebase: `sync-service.ts`, `chain-of-custody.ts`
- Prisma schema: `prisma/schema.prisma`
- Phase 13 RESEARCH.md (offline sync patterns)

### Secondary (MEDIUM confidence)
- Cloudflare R2 documentation for presigned URLs
- AWS S3 SDK documentation

### Tertiary (LOW confidence)
- N/A - all patterns verified in existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed
- Architecture: HIGH - Patterns verified in existing codebase
- Pitfalls: HIGH - Based on actual gaps identified in implementation
- Integration: HIGH - Both codebases thoroughly analyzed

**Research date:** 2026-02-07
**Valid until:** 60 days (stable domain, implementations mostly complete)
