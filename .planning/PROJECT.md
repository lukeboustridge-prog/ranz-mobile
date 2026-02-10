# RANZ Roofing Report Mobile App

## Core Value

Inspectors can capture legally defensible evidence on-site that syncs seamlessly to the web platform for report completion.

## Product Vision

The RANZ Roofing Report mobile app enables RANZ-appointed inspectors to produce legally defensible, ISO-compliant roofing inspection reports. The mobile app handles on-site evidence capture with full metadata preservation for court proceedings.

## Tech Stack

- **Framework:** React Native / Expo (SDK 54)
- **Language:** TypeScript
- **Local Database:** SQLite (expo-sqlite)
- **Authentication:** JWT with secure storage (expo-secure-store)
- **Camera:** expo-camera with EXIF preservation
- **Location:** expo-location with high accuracy tracking
- **File System:** expo-file-system with immutable originals

## Key Requirements

### Evidence Integrity
- SHA-256 hash generated BEFORE any file operations
- Original files stored in immutable directory (never modified)
- Chain of custody logging for all evidence operations
- GPS coordinates embedded in EXIF for external tool verification

### Platform Support
- iOS 14+ (iPhone and iPad)
- Android 10+ (API level 29+)
- Handle iOS HEIC format (convert to JPEG)
- Handle platform-specific permissions

### Offline First
- Full functionality without network
- Local SQLite database mirrors web schema
- Background sync when connectivity restored
- Conflict resolution for concurrent edits

## Directory Structure

```
ranz-mobile/
├── src/
│   ├── components/     # React Native UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Core utilities (sqlite, storage, auth)
│   ├── services/       # Business logic services
│   ├── types/          # TypeScript type definitions
│   ├── contexts/       # React context providers
│   ├── stores/         # Zustand state stores
│   └── utils/          # Helper utilities
├── app/                # Expo Router screens
├── assets/             # Static assets (images, fonts)
└── .planning/          # GSD planning documents
```

## Conventions

### Code Style
- TypeScript strict mode
- Functional components with hooks
- JSDoc comments for public APIs
- Logging via dedicated logger service

### File Naming
- Components: PascalCase (e.g., `CameraCapture.tsx`)
- Utilities: kebab-case (e.g., `exif-utils.ts`)
- Types: PascalCase in kebab-case files (e.g., `types/evidence.ts`)

### Evidence Files
- Originals: `evidence/originals/orig_{id}.jpg` (NEVER modified)
- Working: `photos/{id}.jpg` (may have annotations)
- Thumbnails: `thumbnails/{id}.jpg`
