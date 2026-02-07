# RANZ Roofing Report - Mobile App

React Native mobile app for on-site roofing inspections. Captures photos with GPS metadata, maintains evidence chain of custody, and syncs to the web platform.

## Features

- **Photo Capture**: Camera integration with full EXIF metadata preservation
- **GPS Tracking**: Continuous location logging with accuracy indicators
- **Evidence Integrity**: SHA-256 hashing for court-admissible chain of custody
- **Offline Support**: Full functionality without network, syncs when connected
- **Photo Management**: Gallery with filtering, grouping, and annotations
- **Biometric Auth**: Face ID / fingerprint for secure quick access

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State**: Zustand
- **Database**: SQLite (expo-sqlite)
- **Auth**: Clerk with biometric unlock
- **Sync**: Resumable uploads with TUS protocol

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- For iOS builds: Xcode 16+ (macOS only)
- For Android builds: Android Studio (optional, EAS handles cloud builds)

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd ranz-mobile
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Environment (development, preview, production)
EXPO_PUBLIC_APP_ENV=development

# Clerk Authentication
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# API URL (local dev server)
EXPO_PUBLIC_API_URL=http://localhost:3000

# Sentry (optional for local dev)
EXPO_PUBLIC_SENTRY_DSN=
```

### 3. Start Development

```bash
# Start Expo dev server
npm start

# Or run on specific platform
npm run ios     # iOS Simulator
npm run android # Android Emulator
```

Scan the QR code with Expo Go app, or press `i` for iOS simulator / `a` for Android emulator.

## Building for Release

We use EAS Build for cloud builds. Three profiles are available:

### Development Build

Development client with debugging tools:

```bash
eas build --profile development
```

### Preview Build

Internal testing build (TestFlight / internal track):

```bash
eas build --profile preview --platform all
```

### Production Build

App store release:

```bash
eas build --profile production --platform all
```

### Submitting to Stores

After a production build completes:

```bash
eas submit --platform ios
eas submit --platform android
```

## Project Structure

```
ranz-mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Protected routes
│   ├── (tabs)/            # Tab navigation
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # React Native components
│   ├── config/            # Environment configuration
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Core utilities (SQLite, storage)
│   ├── services/          # Business logic services
│   ├── stores/            # Zustand state stores
│   ├── types/             # TypeScript definitions
│   └── utils/             # Helper utilities
├── assets/                # Images, icons, fonts
├── .planning/             # Development documentation
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
└── package.json          # Dependencies
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_APP_ENV` | Environment name (development/preview/production) | Yes |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication key | Yes |
| `EXPO_PUBLIC_API_URL` | Backend API URL | Yes |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry crash reporting DSN | No (production) |

For production builds, set environment variables in EAS Secrets:

```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://xxx@sentry.io/xxx"
```

## Related Projects

- **Web Platform**: `../RANZ_Roofing_report/` - Next.js web app for report building
- **RANZ Quality Program**: Shared authentication via Clerk SSO

## Documentation

- [API Design](../claude_docs/api-design.md) - REST API endpoints
- [Feature Specs](../claude_docs/feature-specs.md) - Detailed feature specifications
- [Security](../claude_docs/security-and-evidence.md) - Evidence integrity and RBAC

## License

Proprietary - RANZ (Roofing Association of New Zealand)
