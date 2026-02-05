---
phase: 11-camera-gps-capture
plan: 05
subsystem: camera
tags: [heic, ios, image-format, mime-type, photo-capture, evidence]

# Dependency graph
requires:
  - phase: 11-02
    provides: GPS EXIF embedding in photo capture
  - phase: 11-03
    provides: Location validation UI
provides:
  - HEIC format detection utilities
  - Dynamic MIME type detection for photos
  - Format validation in photo capture workflow
affects: [12-sync-engine, pdf-generation, web-platform]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Magic byte detection for binary format identification"
    - "Platform-aware format handling (iOS HEIC vs Android JPEG)"

key-files:
  created:
    - src/lib/heic-utils.ts
  modified:
    - src/services/photo-service.ts

key-decisions:
  - "[heic-01] expo-camera skipProcessing:false returns JPEG - HEIC utilities primarily for future camera roll import feature"
  - "[heic-02] HEIC format acceptable for evidence but flagged for web/PDF conversion awareness"

patterns-established:
  - "Format detection via magic bytes: Detect file type from binary content, not just extension"
  - "Platform-aware utilities: Check Platform.OS for iOS-specific features"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 11 Plan 05: HEIC Format Handling Summary

**HEIC format detection utilities with magic byte validation and dynamic MIME type detection integrated into photo capture workflow**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T18:52:50+13:00
- **Completed:** 2026-01-31T18:54:25+13:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created HEIC format utilities with magic byte detection (ftyp box analysis)
- Added MIME type detection based on file extension and content
- Integrated format validation into photo capture workflow
- Documented that expo-camera with skipProcessing:false returns JPEG by default

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HEIC format utilities** - `71c1048` (feat)
2. **Task 2: Add format validation to photo capture** - `f49e2e0` (feat)

## Files Created/Modified

- `src/lib/heic-utils.ts` - HEIC format detection utilities including:
  - `isHEICFormat()` - Magic byte detection for HEIC content
  - `hasHEICExtension()` - Extension-based HEIC check
  - `getPhotoMimeType()` - Dynamic MIME type detection
  - `needsFormatConversion()` - Platform-aware conversion check
  - `getExtensionForMimeType()` - MIME to extension mapping
  - `isAcceptableFormat()` - Validation for evidence system
  - `logFormatInfo()` - Debug logging utility

- `src/services/photo-service.ts` - Added format validation after photo capture:
  - Import HEIC utilities
  - Detect MIME type dynamically instead of hardcoding
  - Validate format before processing
  - Use detected MIME type in LocalPhoto record

## Decisions Made

- **[heic-01] HEIC utilities primarily for future camera roll import:** Since expo-camera with `skipProcessing: false` returns JPEG by default, the HEIC utilities are primarily valuable for:
  1. Future camera roll import feature (where iOS photos may be HEIC)
  2. Validation layer to catch unexpected formats
  3. Consistent MIME type handling throughout the app

- **[heic-02] HEIC acceptable but flagged:** HEIC format is acceptable for the evidence system (preserves quality, valid format) but is flagged for awareness since web platform and PDF generation may need to handle conversion.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation was straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Format validation integrated into photo capture
- Ready for Phase 11-06: Human verification checkpoint
- Web platform and PDF generation should be aware HEIC format may be encountered (though rare given expo-camera default behavior)

---
*Phase: 11-camera-gps-capture*
*Plan: 05*
*Completed: 2026-01-31*
