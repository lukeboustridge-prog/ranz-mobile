# RANZ Roofing Report — Mobile Application

React Native / Expo app for on-site photo capture, GPS logging, and inspection data collection. Syncs to the web platform via API.

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand (stores in `src/stores/`)
- **Camera**: expo-camera / expo-image-picker
- **Location**: expo-location (continuous GPS tracking)
- **Storage**: AsyncStorage / expo-file-system for offline data

## Directory Structure

```
app/                # Expo Router pages
src/
  components/       # React Native components
  constants/        # App constants and config
  contexts/         # React context providers
  hooks/            # Custom hooks
  lib/              # Utility functions
  services/         # API client, sync engine, photo processing
  stores/           # Zustand state stores
  types/            # TypeScript type definitions
  utils/            # Helper utilities
App.tsx             # Entry point
```

## Mobile-Specific Concerns

### Camera & Photos
- Preserve all EXIF metadata (GPS, timestamps, camera make/model/serial)
- Generate SHA-256 hash of original file immediately on capture
- Never modify the original photo — create separate display/thumbnail copies
- Three-level photo method: Overview, Context, Detail
- Quick-tag photos with element type and defect association

### GPS & Location
- Continuous GPS logging during active inspection
- Store coordinates with each photo (from EXIF and device GPS as backup)
- Display real-time location on capture screen

### Offline Mode
- Full capture functionality without network connectivity
- Queue photos and inspection data locally
- Sync to web API when connectivity restored
- Conflict resolution for concurrent edits

### Sync with Web API
- Base URL configured per environment
- Auth token from Clerk session
- Endpoints documented in `../claude_docs/api-design.md` (see Sync section)
- Bulk upload via `POST /api/sync/upload`
- Status check via `GET /api/sync/status`

## Reference Docs

For shared specs, read from `../claude_docs/`:
- API endpoints: `../claude_docs/api-design.md`
- Feature specs (capture workflow, EXIF fields): `../claude_docs/feature-specs.md`
- UI design system (colours, breakpoints): `../claude_docs/ui-design-system.md`
- Evidence integrity: `../claude_docs/security-and-evidence.md`
- Compliance standards: `../claude_docs/compliance-standards.md`
