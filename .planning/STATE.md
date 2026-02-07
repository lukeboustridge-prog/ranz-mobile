# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Inspectors can capture legally defensible evidence on-site that syncs seamlessly to the web platform for report completion.
**Current focus:** v2.0 Mobile App — Phase 12: Photo Management

## Current Position

Phase: 12 of 15 (Photo Management) — IN PROGRESS
Plan: 2 of X complete
Status: In progress
Last activity: 2026-02-07 — Completed 12-02-PLAN.md

Progress: [████████████████████████████████████████░░░░░░░░░░] 80%

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
- [gal-01] Use capturedAt falling back to createdAt for sorting/grouping dates
- [gal-02] Parse annotationsJson to check for empty array when filtering hasAnnotations
- [gal-03] Date grouping shows Today, Yesterday, or formatted date (e.g., 7 Feb 2026)

### Blockers/Concerns

- SwiftFox OIDC specification not yet available — mobile uses custom auth, SSO scaffolding ready when spec received
- iOS location permission approval rate — need mitigation strategy for "approximate location" denials (addressed in Phase 11 with warning UI)

## Phase 12 Plans

| Wave | Plan | Objective | Status |
|------|------|-----------|--------|
| 1 | 12-01 | Photo management service | pending |
| 1 | 12-02 | Photo gallery hook with filtering/grouping | complete |

## Session Continuity

Last session: 2026-02-07T09:08:00Z
Stopped at: Completed 12-02-PLAN.md
Resume file: None

## Next Steps

Continue Phase 12 photo management plans.
