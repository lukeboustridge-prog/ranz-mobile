# RANZ Roofing Report Mobile App - Development Roadmap

## Overview

This roadmap covers the mobile app component of the RANZ Roofing Report platform. The mobile app enables inspectors to capture legally defensible evidence on-site with full GPS and timestamp metadata.

## Phases

### Phase 10: Evidence Foundation (COMPLETE)
**Goal:** Establish forensic evidence integrity foundation with SHA-256 hashing and chain of custody logging
**Status:** COMPLETE
**Dependencies:** None

---

### Phase 11: Camera + GPS Capture (COMPLETE)
**Goal:** Inspector can capture photos with full EXIF metadata (GPS, timestamp, camera) preserved
**Status:** COMPLETE (verification skipped)
**Completed:** 2026-02-07
**Dependencies:** Phase 10 (evidence foundation)

**Requirements:**
- EVID-01: Inspector can capture photo with GPS coordinates preserved in EXIF
- EVID-02: Inspector can capture photo with timestamp preserved in EXIF
- EVID-03: Inspector can capture photo with camera serial/model preserved in EXIF
- LOCN-01: App tracks GPS coordinates during inspection session
- LOCN-02: GPS accuracy value captured alongside coordinates
- LOCN-03: GPS accuracy indicator visible in capture UI
- LOCN-04: Location validated against expected property address
- PLAT-03: App handles iOS HEIC photo format correctly
- PLAT-04: App handles iOS and Android permission models

**Success Criteria:**
1. Captured photo contains GPS coordinates in EXIF metadata readable by external tools
2. Captured photo contains capture timestamp in EXIF metadata
3. GPS accuracy value is displayed in capture UI so inspector knows signal quality
4. Location validation alerts inspector if capture location is far from property address
5. Camera and location permissions are requested appropriately on both iOS and Android

**Plans:** 6 plans in 4 waves
- [x] 11-01-PLAN.md — GPS EXIF utilities and location validation (Wave 1)
- [x] 11-02-PLAN.md — Integrate GPS EXIF embedding in photo capture (Wave 2)
- [x] 11-03-PLAN.md — Location validation UI in camera capture (Wave 2)
- [x] 11-04-PLAN.md — Permission handling for iOS/Android (Wave 3)
- [x] 11-05-PLAN.md — HEIC format handling (Wave 3)
- [x] 11-06-PLAN.md — Human verification checkpoint (Wave 4) — skipped

---

### Phase 12: Photo Management (COMPLETE)
**Goal:** Inspector can view, organize, annotate, and tag captured photos
**Status:** COMPLETE (verification skipped)
**Completed:** 2026-02-07
**Dependencies:** Phase 11 (camera capture)

**Requirements:**
- GALL-01: Photos display with thumbnails for efficient gallery scrolling
- GALL-02: Photos can be grouped by date, element, tag, or defect
- GALL-03: Photos can be filtered by type, tag, element, or annotation status
- VIEW-01: Full-screen viewer with pinch-to-zoom (1x-5x scale)
- VIEW-02: Swipe navigation between photos in full-screen view
- VIEW-03: Photo metadata displayed in viewer overlay
- ANNO-01: Annotation workflow accessible from gallery
- ANNO-02: Annotated photos show indicator in gallery
- ANNO-03: Original evidence preserved when annotating

**Success Criteria:**
1. Gallery displays photos with 200px thumbnails for smooth scrolling
2. Group tabs switch between date/element/tag/defect organization
3. Filter sheet allows narrowing by photo type, tag, annotations
4. Full-screen viewer supports pinch-zoom, double-tap zoom, swipe navigation
5. Annotation workflow saves to annotation-service, preserving originals
6. Photo count and filter status shown in gallery header

**Plans:** 6 plans in 4 waves
- [x] 12-01-PLAN.md — Thumbnail service and dependencies (Wave 1)
- [x] 12-02-PLAN.md — Photo gallery hook with filtering/grouping (Wave 1)
- [x] 12-03-PLAN.md — Full-screen viewer with zoom (Wave 2)
- [x] 12-04-PLAN.md — Photo gallery screen with organization UI (Wave 2)
- [x] 12-05-PLAN.md — Enhanced annotation workflow (Wave 3)
- [x] 12-06-PLAN.md — Human verification checkpoint (Wave 4) — skipped

---

### Phase 13: Offline Sync (COMPLETE)
**Goal:** App works fully offline and syncs when connectivity restored
**Status:** COMPLETE (verification skipped)
**Completed:** 2026-02-07
**Dependencies:** Phase 11 (camera capture)

**Requirements:**
- SYNC-01: Photos sync automatically when connectivity is restored
- SYNC-02: Background sync runs while app is closed (opportunistic)
- SYNC-03: Idempotency keys prevent duplicate uploads on retry
- SYNC-04: Failed uploads retry with exponential backoff (max 5 attempts)
- SYNC-05: Chain of custody SYNCED event logged after successful upload
- SYNC-06: Evidence hash verified after sync for integrity check
- SYNC-07: Conflict resolution UI for concurrent edits
- SYNC-08: Manual retry available for failed items

**Success Criteria:**
1. Photos captured offline sync automatically when device comes online
2. Sync status bar shows pending/failed counts with retry button
3. Failed items can be retried from UI without app restart
4. SYNCED custody events appear in audit log with hash verification
5. Conflict modal shows when server version differs from local

**Plans:** 5 plans in 4 waves
- [x] 13-01-PLAN.md — Background task migration and idempotency keys (Wave 1)
- [x] 13-02-PLAN.md — Chain of custody SYNCED events wiring (Wave 1)
- [x] 13-03-PLAN.md — Retry queue with max attempts and hash verification (Wave 2)
- [x] 13-04-PLAN.md — Conflict resolution UI and sync status bar (Wave 3)
- [x] 13-05-PLAN.md — Human verification checkpoint (Wave 4) — skipped

---

### Phase 14: Report Integration (COMPLETE)
**Goal:** Photos sync to web platform and appear in report builder
**Status:** COMPLETE (verification skipped)
**Completed:** 2026-02-07
**Dependencies:** Phase 13 (offline sync)

**Requirements:**
- INTG-01: Photo URL updated on server after presigned URL upload
- INTG-02: Server-side thumbnail generation after upload confirmation
- INTG-03: Chain of custody events synced to web audit log
- INTG-04: Hash verification on server matches mobile-computed hash
- INTG-05: Sync status visible in web report builder photo gallery
- INTG-06: Evidence integrity indicator (hash verified) in photo details

**Success Criteria:**
1. Photos captured on mobile appear in web report builder within minutes
2. Thumbnails display correctly (no broken images for pending uploads)
3. Chain of custody events visible in report audit log with original timestamps
4. Hash verification status shown (green = verified, amber = pending)
5. Web UI shows clear sync status for each photo

**Plans:** 5 plans in 4 waves
- [x] 14-01-PLAN.md — Web API endpoints for upload confirmation + custody sync (Wave 1)
- [x] 14-02-PLAN.md — Mobile sync-service update to call confirmation after upload (Wave 2)
- [x] 14-03-PLAN.md — Hash verification and thumbnail generation server-side (Wave 2)
- [x] 14-04-PLAN.md — Web report builder UI for sync status (Wave 3)
- [x] 14-05-PLAN.md — Human verification checkpoint (Wave 4) — skipped

---

### Phase 15: Production Polish
**Goal:** App ready for production deployment with EAS Build, Sentry monitoring, testing, and documentation
**Status:** COMPLETE (verification skipped)
**Completed:** 2026-02-07
**Dependencies:** Phase 14 (report integration)

**Requirements:**
- PROD-01: EAS Build configuration for development, preview, and production profiles
- PROD-02: Environment-aware configuration (API URLs, logging, Sentry)
- PROD-03: Sentry crash reporting for production monitoring
- PROD-04: Automated tests for critical services
- PROD-05: README documentation for developers
- PROD-06: RANZ branded app icons and splash screen

**Success Criteria:**
1. `eas build --profile preview` completes successfully
2. Sentry receives crash reports from preview builds
3. `npm test` passes with all tests green
4. README provides complete setup and build instructions
5. App icons show RANZ branding (not Expo placeholder)
6. App is ready for production build and store submission

**Plans:** 6 plans in 4 waves
- [x] 15-01-PLAN.md — EAS Build configuration (Wave 1)
- [x] 15-02-PLAN.md — Environment configuration (Wave 1)
- [x] 15-03-PLAN.md — Sentry crash reporting integration (Wave 2)
- [x] 15-04-PLAN.md — Jest testing infrastructure (Wave 3)
- [x] 15-05-PLAN.md — README documentation (Wave 3)
- [x] 15-06-PLAN.md — Human verification checkpoint (Wave 4) — skipped
