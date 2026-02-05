# Project State

## Project Reference

See: .planning/PROJECT.md

**Core value:** Inspectors can capture legally defensible evidence on-site that syncs seamlessly to the web platform for report completion.
**Current focus:** v2.0 Mobile App — Phase 11: Camera + GPS Capture

## Current Position

Phase: 11 of 15 (Camera + GPS Capture)
Plan: 3 of 6 complete (11-01, 11-02, 11-03)
Status: In progress
Last activity: 2026-02-05 — Completed 11-03-PLAN.md

Progress: [████████████████████████████░░░░░░░░░░░░░░░░░░░░░░] 46%

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

### Blockers/Concerns

- SwiftFox OIDC specification not yet available — mobile uses custom auth, SSO scaffolding ready when spec received
- iOS location permission approval rate — need mitigation strategy for "approximate location" denials (addressed in Phase 11 with warning UI)

## Phase 11 Plans

| Wave | Plan | Objective | Status |
|------|------|-----------|--------|
| 1 | 11-01 | GPS EXIF utilities and location validation | complete |
| 2 | 11-02 | Integrate GPS EXIF embedding in photo capture | complete |
| 2 | 11-03 | Location validation UI in camera capture | complete |
| 3 | 11-04 | Permission handling for iOS/Android | pending |
| 3 | 11-05 | HEIC format handling | pending |
| 4 | 11-06 | Human verification checkpoint | pending |

## Session Continuity

Last session: 2026-02-05T08:38:30Z
Stopped at: Completed 11-03-PLAN.md
Resume file: None

## Next Steps

Continue Phase 11 execution: Wave 3 plans (11-04, 11-05) are ready
