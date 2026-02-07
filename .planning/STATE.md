# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Inspectors can capture legally defensible evidence on-site that syncs seamlessly to the web platform for report completion.
**Current focus:** v2.0 Mobile App — COMPLETE

## Current Position

Phase: 15 of 15 (Production Polish)
Plan: 6 of 6 complete
Status: COMPLETE
Last activity: 2026-02-07 — Phase 15 complete (verification skipped)

Progress: [██████████████████████████████████████████████████] 100%

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
- [sync-05] MAX_SYNC_RETRY_ATTEMPTS = 5 for balance between retry fairness and battery preservation
- [sync-06] Permanent failure marked by appending :permanently_failed to operation field
- [sync-07] Post-sync verification uses original file in immutable originals/ directory
- [sync-08] Hash verification failures logged but never block sync (fail-safe audit trail)
- [ui-01] Use pageSheet presentation for conflict modal (iOS-style bottom sheet)
- [ui-02] Failed badge is tappable to trigger retry (single-tap UX)
- [ui-03] Conflict resolution logs but does not send to server yet (TODO for future phase)

Phase 14 decisions:
- [api-01] Hash mismatch logged but does NOT fail request (fail-safe for court evidence)
- [api-02] Thumbnail generation non-blocking on server (failures don't prevent upload confirmation)
- [api-03] Custody events with missing entities skipped gracefully (batch tolerant)
- [api-04] Original mobile timestamps preserved in audit log createdAt field
- [sync-05] confirmPhotoUpload is non-blocking - failures logged but don't stop sync
- [sync-06] syncCustodyEvents batched to 100 events per sync for performance
- [sync-07] synced_to_server column on audit_log tracks custody event sync state
- [pp-01] photo-processing module exports reusable utilities for any photo endpoint
- [pp-02] processPhotoForStorage combines hash, thumbnail, metadata in single pass
- [pp-03] Hash comparison case-insensitive for cross-platform robustness
- [ui-04] Use Popover instead of Tooltip for sync status descriptions (no radix tooltip)
- [ui-05] Hash verification indicator only shown for synced photos
- [ui-06] Pending photos use placeholder UI (ImageOff icon) instead of broken images

Phase 15 decisions:
- [eas-01] autoIncrement must be boolean (true), not string 'buildNumber'
- [eas-02] appVersionSource set to 'remote' for EAS-managed versions
- [eas-03] Development uses APK + simulator, production uses app-bundle + store
- [env-01] Sentry DSN null in development, enabled only in preview/production
- [env-02] __DEV__ global used as fallback when EXPO_PUBLIC_APP_ENV not set
- [env-03] Logging enabled in development and preview, disabled in production
- [env-04] Environment-aware logging utilities (envLog, envWarn, envError) for controlled output
- [sentry-01] Sentry only initializes when sentryDsn is configured AND not in development
- [sentry-02] Trace sampling: 20% in production, 100% in preview for debugging
- [sentry-03] Sentry.wrap() applied to root component for error boundary integration
- [test-01] Mocked expo-crypto with Node.js crypto for portable SHA-256 testing
- [test-02] Pure function tests for location-utils (no mocks needed)
- [test-03] Skipped @testing-library/react-native due to React 19 peer conflict

### Blockers/Concerns

- SwiftFox OIDC specification not yet available — mobile uses custom auth, SSO scaffolding ready when spec received
- iOS location permission approval rate — need mitigation strategy for "approximate location" denials (addressed in Phase 11 with warning UI)
- Sentry project setup required — need to create Sentry project and configure EXPO_PUBLIC_SENTRY_DSN and SENTRY_AUTH_TOKEN secrets in EAS

## Phase 15 Plans

| Wave | Plan | Objective | Status |
|------|------|-----------|--------|
| 1 | 15-01 | EAS Build configuration | complete |
| 1 | 15-02 | Environment configuration | complete |
| 2 | 15-03 | Sentry crash reporting integration | complete |
| 3 | 15-04 | Jest testing infrastructure | complete |
| 3 | 15-05 | README documentation | complete |
| 4 | 15-06 | Human verification checkpoint | skipped |

## Session Continuity

Last session: 2026-02-07
Stopped at: Phase 15 complete
Resume file: None

## Next Steps

**MILESTONE COMPLETE** — v2.0 Mobile App development is finished.

Before production deployment:
1. Run `/gsd:verify-work 13` and `/gsd:verify-work 14` (skipped during dev)
2. Create Sentry project and configure EAS secrets (EXPO_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN)
3. Run `eas build --profile preview` to generate first test build
4. Conduct UAT with inspectors on preview build
