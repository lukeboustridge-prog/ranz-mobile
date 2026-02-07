# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Inspectors can capture legally defensible evidence on-site that syncs seamlessly to the web platform for report completion.
**Current focus:** v2.0 Mobile App — Phase 13: Offline Sync

## Current Position

Phase: 13 of 15 (Offline Sync)
Plan: 1 of 5 complete
Status: In progress
Last activity: 2026-02-07 — Completed 13-01-PLAN.md (Background Sync Infrastructure)

Progress: [██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 20%

## Accumulated Context

### Decisions

v2.0 decisions:
- [ev-01] Hash generated from base64 BEFORE file operations (ensures hash reflects exact captured bytes)
- [ev-02] deviceId and hashAtTime stored in JSON details field (leverages existing schema without migration)
- [ev-03] Storage initialized after database (enables error logging to SQLite audit trail)
- [ev-04] Platform paths logged only in __DEV__ mode (security - don't expose paths in production)
- [ev-05] Original filename prefixed with 'orig_' to distinguish from working copies
- [ev-06] Integrity verification uses original file in immutable originals/ directory

Phase 11 decisions:
- [cam-01] Dual-hash strategy: hash original before EXIF, embed GPS in working copy only
- [cam-02] Use piexifjs for GPS EXIF embedding (expo-camera additionalExif has limited Android support)
- [cam-03] Location validation threshold: 500m (configurable)
- [cam-04] Approximate location detection: accuracy > 1000m indicates iOS approximate location
- [cam-05] Photo capture NOT blocked by location warnings (non-blocking UX)
- [cam-06] DMS rational format uses 10000 denominator for sub-second GPS precision
- [cam-07] Haversine formula using WGS84 mean Earth radius (6371000m)
- [heic-01] expo-camera skipProcessing:false returns JPEG - HEIC utilities primarily for future camera roll import feature
- [heic-02] HEIC format acceptable for evidence but flagged for web/PDF conversion awareness
- [perm-01] Permission refresh on app state change for seamless settings return
- [perm-02] Combined requestAllPermissions function for streamlined permission grant flow

Phase 12 decisions:
- [thumb-01] Thumbnail width 200px, JPEG quality 70% for optimal grid performance
- [thumb-02] Thumbnail generation non-blocking: failures return source URI as fallback
- [thumb-03] deleteThumbnail uses idempotent deletion for reliability
- [gal-01] Use capturedAt falling back to createdAt for sorting/grouping dates
- [gal-02] Parse annotationsJson to check for empty array when filtering hasAnnotations
- [gal-03] Date grouping shows Today, Yesterday, or formatted date (e.g., 7 Feb 2026)
- [viewer-01] ImageZoom configured with minScale=1, maxScale=5, doubleTapScale=2
- [viewer-02] Single tap toggles overlay visibility for distraction-free viewing
- [viewer-03] FlatList with pagingEnabled and getItemLayout for optimized gallery scrolling
- [screen-01] Grid view uses 3 columns for optimal mobile display density
- [screen-02] Filter modal uses presentationStyle='pageSheet' for iOS-style bottom sheet
- [screen-03] Empty states differentiate between no photos and no filter matches
- [ann-01] Flow states: viewing, annotating, saving, saved for clear workflow transitions
- [ann-02] Auto-close after 1.5s on successful save for smooth UX
- [ann-03] Evidence integrity banner shows original is preserved
- [ann-04] View Original modal allows comparing annotated vs original photo

Phase 13 decisions:
- [sync-01] expo-background-task uses minutes for minimumInterval, not seconds like expo-background-fetch
- [sync-02] BackgroundTaskResult.Success used for no-data cases (API only has Success/Failed)
- [sync-03] Idempotency key format: {entityType}:{entityId}:{operation}:{timestampMs}
- [sync-04] addToSyncQueue returns boolean (true=added, false=duplicate) instead of throwing

### Blockers/Concerns

- SwiftFox OIDC specification not yet available — mobile uses custom auth, SSO scaffolding ready when spec received
- iOS location permission approval rate — need mitigation strategy for "approximate location" denials (addressed in Phase 11 with warning UI)

## Phase 13 Plans

| Wave | Plan | Objective | Status |
|------|------|-----------|--------|
| 1 | 13-01 | Background sync infrastructure (expo-background-task + idempotency) | complete |
| 1 | 13-02 | Sync custody events | pending |
| 2 | 13-03 | Conflict resolution | pending |
| 2 | 13-04 | Sync service enhancements | pending |
| 3 | 13-05 | Verification checkpoint | pending |

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed 13-01-PLAN.md
Resume file: None

## Next Steps

Continue with Plan 13-02: Sync Custody Events
