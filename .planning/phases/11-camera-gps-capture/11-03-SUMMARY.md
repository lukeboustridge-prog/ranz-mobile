---
phase: 11-camera-gps-capture
plan: 03
subsystem: ui
tags: [camera, gps, location-validation, accuracy, ios, approximate-location, alert]

# Dependency graph
requires:
  - phase: 11-01
    provides: Location validation utilities (validateCaptureLocation, isApproximateLocation, formatGPSAccuracy)
provides:
  - GPS accuracy indicator with approximate location warning in camera UI
  - Location validation alerts when capturing far from property
  - Non-blocking UX that warns but does not prevent capture
affects: [11-06, photo-capture, inspection-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: [non-blocking-location-warning, approximate-location-badge]

key-files:
  created: []
  modified:
    - src/components/CameraCapture.tsx

key-decisions:
  - "[cam-05] Photo capture NOT blocked by location warnings (non-blocking UX)"
  - "500m validation threshold passed to validateCaptureLocation"
  - "APPROX badge displayed when GPS accuracy > 1000m"
  - "Location warning auto-dismisses after 5 seconds"

patterns-established:
  - "Non-blocking warning overlay: Show informative warning but allow action to proceed"
  - "Approximate location badge: Compact amber APPROX indicator for iOS approximate mode"
  - "Location validation on capture: Check distance from property before/during capture"

# Metrics
duration: 8min
completed: 2026-02-05
---

# Phase 11 Plan 03: Location Validation UI in Camera Capture Summary

**GPS accuracy indicator with APPROX badge and non-blocking location validation alerts for on-site evidence capture**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-05T08:30:00Z
- **Completed:** 2026-02-05T08:38:30Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Added location utilities imports and propertyLocation prop to CameraCapture
- Implemented iOS approximate location detection with APPROX badge display
- Added location validation on capture with non-blocking warning overlay
- Warning auto-dismisses after 5 seconds without blocking photo capture

## Task Commits

Each task was committed atomically:

1. **Task 1: Add location utilities imports and prop for property location** - `f3006db` (feat)
2. **Task 2: Add approximate location warning to GPS indicator** - `c80197d` (feat)
3. **Task 3: Add location validation alert on capture** - `92cd25c` (feat)

## Files Created/Modified

- `src/components/CameraCapture.tsx` - Enhanced with GPS accuracy display, APPROX badge, propertyLocation prop, and location validation overlay

## Decisions Made

- **Non-blocking UX:** Location warnings inform but do not prevent photo capture - critical for field usability when GPS is unreliable
- **5-second auto-dismiss:** Warning shows briefly to inform inspector without obstructing repeated captures
- **500m threshold:** Inherited from 11-01 decision [cam-03], balances GPS accuracy with large property boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Camera capture now validates location against property coordinates when provided
- Approximate location detection alerts inspectors to enable precise location on iOS
- Ready for permission handling (11-04) and HEIC format handling (11-05)
- Human verification checkpoint (11-06) can test full GPS/location UI

---
*Phase: 11-camera-gps-capture*
*Completed: 2026-02-05*
