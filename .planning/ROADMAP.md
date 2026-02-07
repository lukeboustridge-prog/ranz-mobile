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

### Phase 12: Photo Management
**Goal:** Inspector can view, organize, annotate, and tag captured photos
**Status:** Not started
**Dependencies:** Phase 11 (camera capture)

---

### Phase 13: Offline Sync
**Goal:** App works fully offline and syncs when connectivity restored
**Status:** Not started
**Dependencies:** Phase 11 (camera capture)

---

### Phase 14: Report Integration
**Goal:** Photos sync to web platform and appear in report builder
**Status:** Not started
**Dependencies:** Phase 13 (offline sync)

---

### Phase 15: Production Polish
**Goal:** App ready for production deployment
**Status:** Not started
**Dependencies:** Phase 14 (report integration)
