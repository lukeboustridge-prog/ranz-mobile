# RANZ Roofing Inspection Report Platform
## Technical Build Specification v1.0

---

## 1. Executive Summary

### Project Vision
Create a digital platform that enables RANZ-appointed inspectors to produce legally defensible, ISO-compliant roofing inspection reports that can be used in disputes, court proceedings, and LBP Board complaints.

### Key Outcomes
- **For Inspectors**: Easy-to-use mobile + web platform for on-site data capture
- **For RANZ**: Standardised, branded reports establishing industry benchmark
- **For End Users**: Court-ready, professional documentation
- **For Industry**: Consistent reporting standards across New Zealand

### Core Requirements Summary
| Requirement | Solution |
|-------------|----------|
| Mobile photo capture | React Native / PWA mobile app |
| Web report completion | Next.js web application |
| Photo metadata (GPS, timestamp) | EXIF extraction + verification |
| Video storage | Cloud storage with streaming |
| PDF report generation | Server-side PDF rendering |
| RANZ branding | Consistent design system |
| Evidence integrity | Hash verification + chain of custody |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RANZ Roofing Report Platform                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │   Mobile    │    │    Web      │    │      Admin Portal       │ │
│  │    App      │    │ Application │    │    (RANZ Staff)         │ │
│  │(React Native)│   │  (Next.js)  │    │      (Next.js)          │ │
│  └──────┬──────┘    └──────┬──────┘    └───────────┬─────────────┘ │
│         │                  │                       │               │
│         └──────────────────┴───────────────────────┘               │
│                            │                                       │
│                    ┌───────▼───────┐                               │
│                    │   API Layer   │                               │
│                    │   (Next.js    │                               │
│                    │  API Routes)  │                               │
│                    └───────┬───────┘                               │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         │                  │                  │                    │
│  ┌──────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐             │
│  │  Database   │   │ File Storage  │  │   PDF Gen   │             │
│  │ (PostgreSQL)│   │   (S3/R2)     │  │  (Puppeteer)│             │
│  └─────────────┘   └───────────────┘  └─────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend - Web** | Next.js 14+ (App Router) | SSR, API routes, great DX |
| **Frontend - Mobile** | React Native / Expo | Cross-platform, code sharing |
| **Styling** | Tailwind CSS | Rapid development, consistent design |
| **UI Components** | shadcn/ui | Accessible, customisable |
| **Database** | PostgreSQL (Supabase/Neon) | Relational, reliable, scalable |
| **ORM** | Prisma | Type-safe, migrations |
| **Authentication** | NextAuth.js / Clerk | Secure, role-based access |
| **File Storage** | Cloudflare R2 / AWS S3 | Cost-effective media storage |
| **PDF Generation** | Puppeteer / @react-pdf/renderer | High-quality PDF output |
| **Image Processing** | Sharp | EXIF extraction, optimisation |
| **Hosting** | Vercel / Railway | Easy deployment, scaling |

### 2.3 Mobile App Strategy

**Option A: React Native (Expo) - Recommended**
- Full native camera access
- Background GPS tracking
- Offline capability with sync
- App Store distribution

**Option B: Progressive Web App (PWA)**
- No app store needed
- Easier updates
- Limited offline/camera features
- Good for MVP/pilot

**Recommendation**: Start with PWA for rapid iteration, transition to React Native for production.

---

## 3. Database Schema

### 3.1 Core Entities

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTHENTICATION
// ============================================

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  phone           String?
  role            UserRole  @default(INSPECTOR)
  status          UserStatus @default(ACTIVE)
  
  // Inspector credentials
  qualifications  String?   @db.Text
  lbpNumber       String?
  yearsExperience Int?
  specialisations String[]  // metal, tile, membrane, etc.
  cvUrl           String?
  
  // Authentication
  passwordHash    String?
  emailVerified   DateTime?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  reports         Report[]
  assignments     Assignment[]
  sessions        Session[]
}

enum UserRole {
  INSPECTOR
  REVIEWER
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING_APPROVAL
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}

// ============================================
// INSPECTION REPORTS
// ============================================

model Report {
  id                String       @id @default(cuid())
  reportNumber      String       @unique // RANZ-2025-001234
  status            ReportStatus @default(DRAFT)
  
  // Property Details
  propertyAddress   String
  propertyCity      String
  propertyRegion    String
  propertyPostcode  String
  propertyType      PropertyType
  buildingAge       Int?
  gpsLat            Float?
  gpsLng            Float?
  
  // Inspection Details
  inspectionDate    DateTime
  inspectionType    InspectionType
  weatherConditions String?
  temperature       Float?
  accessMethod      String?       // ladder, scaffold, drone, etc.
  limitations       String?       @db.Text
  
  // Client Information
  clientName        String
  clientEmail       String?
  clientPhone       String?
  clientCompany     String?
  engagingParty     String?       // Who commissioned the report
  
  // Building Consent
  consentNumber     String?
  consentDate       DateTime?
  codeOfComplianceDate DateTime?
  
  // Report Content (JSON for flexibility)
  scopeOfWorks      Json?         // What was inspected
  methodology       Json?         // How inspection was conducted
  equipment         Json?         // Equipment used
  findings          Json?         // Observations and defects
  analysis          Json?         // Technical analysis
  conclusions       Json?         // Professional opinions
  recommendations   Json?         // Remediation steps
  
  // Compliance Assessment
  e2Compliance      Json?         // E2 External Moisture
  b2Compliance      Json?         // B2 Durability
  copCompliance     Json?         // Metal Roof COP
  
  // Sign-off
  declarationSigned Boolean       @default(false)
  signedAt          DateTime?
  signatureUrl      String?
  
  // Metadata
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  submittedAt       DateTime?
  approvedAt        DateTime?
  
  // PDF Generation
  pdfUrl            String?
  pdfGeneratedAt    DateTime?
  pdfVersion        Int           @default(1)
  
  // Relationships
  inspectorId       String
  inspector         User          @relation(fields: [inspectorId], references: [id])
  reviewerId        String?
  
  photos            Photo[]
  videos            Video[]
  documents         Document[]
  defects           Defect[]
  roofElements      RoofElement[]
  auditLog          AuditLog[]
  
  @@index([reportNumber])
  @@index([inspectorId])
  @@index([status])
  @@index([inspectionDate])
}

enum ReportStatus {
  DRAFT
  IN_PROGRESS
  PENDING_REVIEW
  UNDER_REVIEW
  REVISION_REQUIRED
  APPROVED
  FINALISED
  ARCHIVED
}

enum PropertyType {
  RESIDENTIAL_1      // Single dwelling
  RESIDENTIAL_2      // Multi-unit 2-3 storeys
  RESIDENTIAL_3      // Multi-unit 4+ storeys
  COMMERCIAL_LOW     // Commercial 1-2 storeys
  COMMERCIAL_HIGH    // Commercial 3+ storeys
  INDUSTRIAL
}

enum InspectionType {
  FULL_INSPECTION
  VISUAL_ONLY
  NON_INVASIVE
  INVASIVE
  DISPUTE_RESOLUTION
  PRE_PURCHASE
  MAINTENANCE_REVIEW
  WARRANTY_CLAIM
}

// ============================================
// ROOF ELEMENTS & DEFECTS
// ============================================

model RoofElement {
  id            String        @id @default(cuid())
  reportId      String
  report        Report        @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  elementType   ElementType
  location      String        // e.g., "North elevation", "Main roof"
  
  // Cladding Details
  claddingType  String?       // Corrugated, standing seam, tiles, etc.
  claddingProfile String?     // Manufacturer profile name
  material      String?       // Steel, aluminium, concrete tile, etc.
  manufacturer  String?
  colour        String?
  
  // Technical Specs
  pitch         Float?        // Degrees
  area          Float?        // Square metres
  ageYears      Int?
  
  // Condition Rating
  conditionRating ConditionRating?
  conditionNotes  String?     @db.Text
  
  // Compliance
  meetsCop      Boolean?
  meetsE2       Boolean?
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  defects       Defect[]
  photos        Photo[]
}

enum ElementType {
  ROOF_CLADDING
  RIDGE
  VALLEY
  HIP
  BARGE
  FASCIA
  GUTTER
  DOWNPIPE
  FLASHING_WALL
  FLASHING_PENETRATION
  FLASHING_PARAPET
  SKYLIGHT
  VENT
  ANTENNA_MOUNT
  SOLAR_PANEL
  UNDERLAY
  INSULATION
  ROOF_STRUCTURE
  OTHER
}

enum ConditionRating {
  GOOD
  FAIR
  POOR
  CRITICAL
  NOT_INSPECTED
}

model Defect {
  id                String           @id @default(cuid())
  reportId          String
  report            Report           @relation(fields: [reportId], references: [id], onDelete: Cascade)
  roofElementId     String?
  roofElement       RoofElement?     @relation(fields: [roofElementId], references: [id])
  
  // Defect Details
  defectNumber      Int              // Sequential within report
  title             String
  description       String           @db.Text
  location          String
  
  // Classification (AS 4349.1 aligned)
  classification    DefectClass
  severity          DefectSeverity
  
  // Technical Assessment
  observation       String           @db.Text  // Factual description
  analysis          String?          @db.Text  // Technical interpretation
  opinion           String?          @db.Text  // Professional opinion
  
  // Compliance References
  codeReference     String?          // e.g., "E2/AS1 Section 9.1"
  copReference      String?          // e.g., "COP v25.12 Section 7.1"
  
  // Causation
  probableCause     String?          @db.Text
  contributingFactors String?        @db.Text
  
  // Recommendations
  recommendation    String?          @db.Text
  priorityLevel     PriorityLevel?
  estimatedCost     String?          // Range or guidance
  
  // Measurements
  measurements      Json?            // Flexible for various measurements
  
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  
  photos            Photo[]
}

enum DefectClass {
  MAJOR_DEFECT       // Structural/serviceability impact
  MINOR_DEFECT       // Non-structural deviation
  SAFETY_HAZARD      // Risk to occupants
  MAINTENANCE_ITEM   // Wear and tear
  WORKMANSHIP_ISSUE  // Installation quality
}

enum DefectSeverity {
  CRITICAL           // Immediate action required
  HIGH               // Action within 1 month
  MEDIUM             // Action within 3 months
  LOW                // Action within 12 months
}

enum PriorityLevel {
  IMMEDIATE          // Safety/urgent weathertightness
  SHORT_TERM         // 1-3 months
  MEDIUM_TERM        // 3-12 months
  LONG_TERM          // 12+ months
}

// ============================================
// MEDIA & EVIDENCE
// ============================================

model Photo {
  id              String       @id @default(cuid())
  reportId        String
  report          Report       @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  // Optional relationships
  defectId        String?
  defect          Defect?      @relation(fields: [defectId], references: [id])
  roofElementId   String?
  roofElement     RoofElement? @relation(fields: [roofElementId], references: [id])
  
  // File Info
  filename        String
  originalFilename String
  mimeType        String
  fileSize        Int          // Bytes
  url             String       // Storage URL
  thumbnailUrl    String?
  
  // Photo Type (Three-Level Method)
  photoType       PhotoType
  
  // EXIF Metadata (Critical for evidence)
  capturedAt      DateTime?    // From EXIF
  gpsLat          Float?
  gpsLng          Float?
  gpsAltitude     Float?
  cameraMake      String?
  cameraModel     String?
  cameraSerial    String?
  exposureTime    String?
  fNumber         Float?
  iso             Int?
  focalLength     Float?
  
  // Evidence Integrity
  originalHash    String       // SHA-256 of original file
  hashVerified    Boolean      @default(false)
  isEdited        Boolean      @default(false)
  editedFrom      String?      // Original photo ID if edited
  
  // Annotations
  caption         String?
  annotations     Json?        // Markup data
  scaleReference  String?      // e.g., "Ruler visible: 300mm"
  
  // Display Order
  sortOrder       Int          @default(0)
  
  createdAt       DateTime     @default(now())
  uploadedAt      DateTime     @default(now())
}

enum PhotoType {
  OVERVIEW         // Wide shot showing location
  CONTEXT          // Mid-range showing element in context
  DETAIL           // Close-up of specific defect/feature
  SCALE_REFERENCE  // Photo with measurement reference
  INACCESSIBLE     // Documentation of inaccessible areas
  EQUIPMENT        // Calibration/equipment photos
  GENERAL          // Other documentation
}

model Video {
  id              String       @id @default(cuid())
  reportId        String
  report          Report       @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  // File Info
  filename        String
  originalFilename String
  mimeType        String
  fileSize        Int
  duration        Int?         // Seconds
  url             String
  thumbnailUrl    String?
  
  // Metadata
  capturedAt      DateTime?
  gpsLat          Float?
  gpsLng          Float?
  
  // Evidence Integrity
  originalHash    String
  
  // Description
  title           String?
  description     String?      @db.Text
  
  createdAt       DateTime     @default(now())
}

model Document {
  id              String       @id @default(cuid())
  reportId        String
  report          Report       @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  documentType    DocumentType
  title           String
  filename        String
  mimeType        String
  fileSize        Int
  url             String
  
  createdAt       DateTime     @default(now())
}

enum DocumentType {
  BUILDING_CONSENT
  CODE_OF_COMPLIANCE
  MANUFACTURER_SPEC
  PREVIOUS_REPORT
  CORRESPONDENCE
  CALIBRATION_CERT
  OTHER
}

// ============================================
// AUDIT & COMPLIANCE
// ============================================

model AuditLog {
  id          String     @id @default(cuid())
  reportId    String
  report      Report     @relation(fields: [reportId], references: [id], onDelete: Cascade)
  
  action      AuditAction
  userId      String
  details     Json?
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime   @default(now())
}

enum AuditAction {
  CREATED
  UPDATED
  PHOTO_ADDED
  PHOTO_DELETED
  VIDEO_ADDED
  DEFECT_ADDED
  DEFECT_UPDATED
  STATUS_CHANGED
  SUBMITTED
  REVIEWED
  APPROVED
  PDF_GENERATED
  DOWNLOADED
  SHARED
}

// ============================================
// ASSIGNMENTS & WORKFLOW
// ============================================

model Assignment {
  id            String           @id @default(cuid())
  inspectorId   String
  inspector     User             @relation(fields: [inspectorId], references: [id])
  
  // Client Request
  clientName    String
  clientEmail   String
  clientPhone   String?
  propertyAddress String
  
  // Assignment Details
  requestType   InspectionType
  urgency       AssignmentUrgency
  notes         String?          @db.Text
  
  status        AssignmentStatus @default(PENDING)
  
  scheduledDate DateTime?
  completedDate DateTime?
  
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

enum AssignmentStatus {
  PENDING
  ACCEPTED
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum AssignmentUrgency {
  STANDARD       // 2-3 weeks
  PRIORITY       // 1 week
  URGENT         // 48 hours
  EMERGENCY      // Same day
}

// ============================================
// TEMPLATES & CONFIGURATION
// ============================================

model ReportTemplate {
  id            String   @id @default(cuid())
  name          String
  description   String?
  type          InspectionType
  
  // Template structure as JSON
  sections      Json
  checklists    Json?
  
  isDefault     Boolean  @default(false)
  isActive      Boolean  @default(true)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Checklist {
  id            String   @id @default(cuid())
  templateId    String?
  
  name          String
  category      String
  items         Json     // Array of checklist items
  
  createdAt     DateTime @default(now())
}
```

---

## 4. Feature Specifications

### 4.1 Mobile App Features

#### Core Capture Features
| Feature | Description | Priority |
|---------|-------------|----------|
| **Camera Integration** | Native camera with EXIF preservation | P0 |
| **GPS Tracking** | Continuous location logging | P0 |
| **Offline Mode** | Full functionality without connectivity | P0 |
| **Photo Annotation** | Draw on photos, add markers | P1 |
| **Voice Notes** | Audio recording for observations | P1 |
| **Video Capture** | Record walkthrough videos | P1 |
| **Barcode/QR Scanner** | Scan product codes, consent numbers | P2 |
| **Measurement Tools** | AR-assisted measurements | P3 |

#### Photo Capture Workflow
```
┌─────────────────────────────────────────────────────────────┐
│                    PHOTO CAPTURE SCREEN                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │                   CAMERA VIEWFINDER                   │   │
│  │                                                       │   │
│  │                                                       │   │
│  │    [Grid Overlay]      [Level Indicator]             │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Photo Type:  ○ Overview  ● Context  ○ Detail       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Element:  [Dropdown: Ridge / Flashing / etc.]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Quick Tag:  [Defect] [Good] [Inaccessible] [Scale] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────┐  ┌───┐  ┌────────────────────┐    │
│  │    Gallery (12)    │  │ ◉ │  │    Flash / HDR     │    │
│  └────────────────────┘  └───┘  └────────────────────┘    │
│                                                             │
│  📍 GPS: -36.8485, 174.7633  ⏰ 2025-01-23 14:32:05       │
└─────────────────────────────────────────────────────────────┘
```

#### EXIF Metadata Capture
```javascript
// Required EXIF fields to extract and store
const requiredExifFields = {
  // Timestamp
  DateTimeOriginal: true,
  DateTimeDigitized: true,
  
  // GPS
  GPSLatitude: true,
  GPSLongitude: true,
  GPSAltitude: true,
  GPSDateStamp: true,
  GPSTimeStamp: true,
  
  // Device
  Make: true,
  Model: true,
  SerialNumber: true,
  Software: true,
  
  // Image Settings (proves unaltered)
  ExposureTime: true,
  FNumber: true,
  ISO: true,
  FocalLength: true,
  
  // Integrity
  ImageUniqueID: true,
};
```

### 4.2 Web Application Features

#### Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  RANZ ROOFING REPORTS                      👤 Sean Brandon  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────┐ │
│  │   DRAFTS    │ │ IN PROGRESS │ │   PENDING   │ │COMPLETE│ │
│  │     3       │ │      2      │ │    REVIEW   │ │  127   │ │
│  │             │ │             │ │      1      │ │        │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────┘ │
│                                                             │
│  RECENT REPORTS                                [+ New Report]│
│  ┌─────────────────────────────────────────────────────┐   │
│  │ RANZ-2025-00234  │ 123 Queen St, Auckland │ Draft   │   │
│  │ Updated 2 hours ago                                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ RANZ-2025-00233  │ 45 Willis St, Wellington│ Complete│   │
│  │ Finalised yesterday                                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ RANZ-2025-00232  │ 78 Cashel St, CHCH    │ Review   │   │
│  │ Submitted 3 days ago                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  UPCOMING INSPECTIONS                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📅 Tomorrow 9:00am  │  Commercial - 5 storey        │   │
│  │ 📅 Friday 2:00pm    │  Residential dispute          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Report Editor
Multi-step wizard with auto-save:

**Step 1: Property Details**
- Address (with NZ address autocomplete)
- Property type
- Building consent info
- Client details

**Step 2: Inspection Details**
- Date, time, weather
- Access method
- Scope and limitations
- Equipment used

**Step 3: Roof Elements**
- Add each roof element
- Type, location, material
- Condition rating
- Photos linked

**Step 4: Defects**
- Defect classification
- Three-part structure: Observation → Analysis → Opinion
- Photo linking with annotations
- Code references
- Priority and recommendations

**Step 5: Compliance Assessment**
- E2/AS1 checklist
- Metal Roof COP checklist
- B2 Durability assessment
- Non-compliance summary

**Step 6: Conclusions**
- Professional opinions (clearly labelled)
- Summary of findings
- Recommendations with priorities
- Further investigation needs

**Step 7: Declaration & Sign-off**
- Code of Conduct compliance statement
- Digital signature
- Preview and generate PDF

### 4.3 PDF Report Generation

#### Report Structure (ISO 17020 / High Court Rules Compliant)

```
RANZ ROOFING INSPECTION REPORT
══════════════════════════════════════════════

COVER PAGE
├── RANZ Logo & Branding
├── Report Number: RANZ-2025-00234
├── Property Address
├── Inspection Date
├── Inspector Name & Credentials
├── Classification: CONFIDENTIAL - PREPARED FOR [CLIENT]

CODE OF CONDUCT DECLARATION (Page 2)
├── High Court Rules Schedule 4 Compliance Statement
├── Independence Declaration
├── Conflicts of Interest Disclosure
├── Fee Arrangement Disclosure (if applicable)

EXECUTIVE SUMMARY (1 page max)
├── Key Findings (bullet points)
├── Major Defects Summary
├── Overall Condition Assessment
├── Critical Recommendations
├── (Readable as standalone document)

TABLE OF CONTENTS
├── Hyperlinked for digital navigation
├── Section page numbers

GLOSSARY OF TERMS
├── Technical terms with plain language definitions

1. INTRODUCTION & SCOPE
├── 1.1 Purpose of Engagement
├── 1.2 Instructions Received
├── 1.3 Scope Definition
├── 1.4 Limitations Statement
├── 1.5 Standards & Codes Referenced

2. INSPECTOR CREDENTIALS
├── 2.1 Qualifications & Experience
├── 2.2 Competence Statement
├── 2.3 Independence Declaration
├── 2.4 CV (Appendix Reference)

3. METHODOLOGY
├── 3.1 Inspection Process
├── 3.2 Equipment Used (with calibration status)
├── 3.3 Weather Conditions
├── 3.4 Testing Procedures
├── 3.5 Reproducibility Statement

4. PROPERTY DESCRIPTION
├── 4.1 General Description
├── 4.2 Building Age & History
├── 4.3 Consent Information
├── 4.4 Site Plan (if available)

5. FACTUAL OBSERVATIONS
├── 5.1 Roof Element 1 [with integrated photos]
│   ├── Location
│   ├── Description
│   ├── Condition Rating
│   ├── Photographs (overview, context, detail)
├── 5.2 Roof Element 2...
├── [Systematic by element/area]

6. DEFECTS REGISTER
├── 6.1 Defect #1
│   ├── Classification: [Major/Minor/Safety/Maintenance]
│   ├── Location
│   ├── OBSERVATION: [Factual description]
│   ├── ANALYSIS: [Technical interpretation]
│   ├── OPINION: [Professional judgment - clearly labelled]
│   ├── Photographs (with scale reference)
│   ├── Code Reference
│   ├── Priority
│   ├── Recommendation
├── 6.2 Defect #2...

7. BUILDING CODE COMPLIANCE
├── 7.1 E2 External Moisture Assessment
│   ├── E2.3.1 Precipitation shedding
│   ├── E2.3.2 Moisture penetration
├── 7.2 B2 Durability Assessment
│   ├── Material life expectancy
│   ├── Current condition vs expected
├── 7.3 Metal Roof COP Compliance
│   ├── Section-by-section assessment
├── 7.4 Non-Compliance Summary

8. ANALYSIS & DISCUSSION
├── 8.1 Technical Interpretation
├── 8.2 Causation Analysis
├── 8.3 Consequential Damage Assessment
├── 8.4 Alternative Explanations Considered

9. OPINIONS & CONCLUSIONS
├── "In my professional opinion..."
├── "To a reasonable degree of professional certainty..."
├── Explicit reasoning chain
├── Uncertainties acknowledged

10. RECOMMENDATIONS
├── 10.1 Immediate Actions (Safety/Urgent)
├── 10.2 Short-term (1-3 months)
├── 10.3 Medium-term (3-12 months)
├── 10.4 Specialist Referrals
├── 10.5 Cost Guidance

APPENDICES
├── A: Photograph Index (numbered, described)
├── B: Site Plan / Defect Location Map
├── C: Chain of Custody Documentation
├── D: Equipment Calibration Certificates
├── E: Inspector CV
├── F: Standards & References
├── G: Full-size Photographs

EVIDENCE INTEGRITY CERTIFICATE
├── File hashes for all photos
├── Verification statement
├── Chain of custody summary
```

### 4.4 Evidence Integrity System

```javascript
// Hash generation on photo upload
async function processPhotoUpload(file: File): Promise<PhotoMetadata> {
  // 1. Read original file
  const buffer = await file.arrayBuffer();
  
  // 2. Generate SHA-256 hash BEFORE any processing
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const originalHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 3. Extract EXIF data
  const exifData = await extractExif(buffer);
  
  // 4. Store original file (never modify)
  const originalUrl = await uploadToStorage(file, 'originals/');
  
  // 5. Create optimised version for display (separate file)
  const optimised = await optimiseImage(buffer);
  const displayUrl = await uploadToStorage(optimised, 'display/');
  
  // 6. Generate thumbnail
  const thumbnail = await createThumbnail(buffer);
  const thumbnailUrl = await uploadToStorage(thumbnail, 'thumbnails/');
  
  return {
    originalHash,
    hashVerified: true,
    isEdited: false,
    originalUrl,
    displayUrl,
    thumbnailUrl,
    exif: exifData,
    uploadedAt: new Date(),
    uploadedBy: currentUser.id,
  };
}
```

---

## 5. User Interface Design

### 5.1 Design System

#### Brand Colours (RANZ)
```css
:root {
  /* Primary - RANZ Blue */
  --ranz-blue-900: #0c1929;
  --ranz-blue-800: #142942;
  --ranz-blue-700: #1c3a5c;
  --ranz-blue-600: #254b75;
  --ranz-blue-500: #2d5c8f;  /* Primary */
  --ranz-blue-400: #4a7ab0;
  --ranz-blue-300: #7199c4;
  --ranz-blue-200: #a3bed9;
  --ranz-blue-100: #d1deed;
  --ranz-blue-50: #e8eef6;
  
  /* Accent - Safety Orange */
  --ranz-orange-500: #e65100;
  --ranz-orange-400: #ff6d00;
  --ranz-orange-300: #ff9e40;
  
  /* Status Colours */
  --status-critical: #dc2626;
  --status-high: #ea580c;
  --status-medium: #ca8a04;
  --status-low: #16a34a;
  
  /* Condition Ratings */
  --condition-good: #16a34a;
  --condition-fair: #ca8a04;
  --condition-poor: #ea580c;
  --condition-critical: #dc2626;
  
  /* Neutrals */
  --gray-900: #111827;
  --gray-700: #374151;
  --gray-500: #6b7280;
  --gray-300: #d1d5db;
  --gray-100: #f3f4f6;
  --gray-50: #f9fafb;
  
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
}
```

#### Typography
```css
:root {
  /* Headings - Professional, authoritative */
  --font-heading: 'DM Sans', system-ui, sans-serif;
  
  /* Body - Clear, readable */
  --font-body: 'Inter', system-ui, sans-serif;
  
  /* Mono - Code, technical data */
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
}
```

### 5.2 Component Library

Core components needed (using shadcn/ui as base):

| Component | Usage |
|-----------|-------|
| `Button` | Actions, submissions |
| `Input` | Text fields |
| `Textarea` | Long-form content |
| `Select` | Dropdowns, classifications |
| `Checkbox` | Checklists, multi-select |
| `RadioGroup` | Single selection |
| `Card` | Content containers |
| `Dialog` | Modals, confirmations |
| `Sheet` | Side panels (mobile) |
| `Tabs` | Section navigation |
| `Accordion` | Expandable sections |
| `Badge` | Status indicators |
| `Progress` | Upload/completion progress |
| `Toast` | Notifications |
| `Tooltip` | Help text |
| `Calendar` | Date selection |
| `DataTable` | Report listings |
| `FileUpload` | Photo/document upload |
| `Signature` | Digital signature capture |

### 5.3 Mobile-First Design

```
Mobile Breakpoints:
- sm: 640px   (Large phones)
- md: 768px   (Tablets)
- lg: 1024px  (Laptops)
- xl: 1280px  (Desktops)
- 2xl: 1536px (Large screens)

Key mobile considerations:
1. Touch-friendly targets (min 44px)
2. Bottom navigation for primary actions
3. Swipe gestures for photo gallery
4. Offline indicator
5. Sync status always visible
6. Large capture button for camera
```

---

## 6. API Design

### 6.1 REST API Endpoints

```
Authentication
──────────────────────────────────────────
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

Reports
──────────────────────────────────────────
GET    /api/reports                    # List all reports (paginated)
POST   /api/reports                    # Create new report
GET    /api/reports/:id                # Get report details
PUT    /api/reports/:id                # Update report
DELETE /api/reports/:id                # Delete draft report
POST   /api/reports/:id/submit         # Submit for review
POST   /api/reports/:id/approve        # Approve report
GET    /api/reports/:id/pdf            # Generate/download PDF

Photos
──────────────────────────────────────────
GET    /api/reports/:id/photos         # List report photos
POST   /api/reports/:id/photos         # Upload photo(s)
GET    /api/reports/:id/photos/:photoId
PUT    /api/reports/:id/photos/:photoId  # Update metadata
DELETE /api/reports/:id/photos/:photoId

Defects
──────────────────────────────────────────
GET    /api/reports/:id/defects
POST   /api/reports/:id/defects
GET    /api/reports/:id/defects/:defectId
PUT    /api/reports/:id/defects/:defectId
DELETE /api/reports/:id/defects/:defectId

Roof Elements
──────────────────────────────────────────
GET    /api/reports/:id/elements
POST   /api/reports/:id/elements
PUT    /api/reports/:id/elements/:elementId
DELETE /api/reports/:id/elements/:elementId

Templates
──────────────────────────────────────────
GET    /api/templates
GET    /api/templates/:id
POST   /api/templates                  # Admin only
PUT    /api/templates/:id              # Admin only

Users (Admin)
──────────────────────────────────────────
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
GET    /api/admin/users/:id/reports

Sync (Mobile)
──────────────────────────────────────────
POST   /api/sync/upload                # Bulk upload offline data
GET    /api/sync/status                # Get sync status
POST   /api/sync/resolve               # Resolve conflicts
```

### 6.2 Data Transfer Objects

```typescript
// Report creation
interface CreateReportDTO {
  propertyAddress: string;
  propertyCity: string;
  propertyRegion: string;
  propertyPostcode: string;
  propertyType: PropertyType;
  inspectionDate: Date;
  inspectionType: InspectionType;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
}

// Photo upload
interface UploadPhotoDTO {
  file: File;
  photoType: PhotoType;
  roofElementId?: string;
  defectId?: string;
  caption?: string;
  // EXIF extracted server-side from file
}

// Defect creation
interface CreateDefectDTO {
  title: string;
  description: string;
  location: string;
  classification: DefectClass;
  severity: DefectSeverity;
  observation: string;        // Required
  analysis?: string;
  opinion?: string;
  codeReference?: string;
  copReference?: string;
  probableCause?: string;
  recommendation?: string;
  priorityLevel?: PriorityLevel;
  photoIds?: string[];
}
```

---

## 7. Security Considerations

### 7.1 Authentication & Authorisation

```typescript
// Role-based access control
const permissions = {
  INSPECTOR: [
    'report:create',
    'report:read:own',
    'report:update:own',
    'report:delete:draft:own',
    'report:submit:own',
    'photo:upload',
    'photo:delete:own',
  ],
  REVIEWER: [
    ...permissions.INSPECTOR,
    'report:read:all',
    'report:review',
    'report:approve',
    'report:reject',
  ],
  ADMIN: [
    ...permissions.REVIEWER,
    'user:read',
    'user:create',
    'user:update',
    'template:manage',
    'report:delete:any',
  ],
  SUPER_ADMIN: ['*'],
};
```

### 7.2 Data Protection

| Data Type | Protection Method |
|-----------|-------------------|
| Passwords | bcrypt hash (12 rounds) |
| API tokens | JWT with short expiry + refresh |
| Photos | Original hash verification |
| PII | Encrypted at rest (AES-256) |
| Reports | Access control by ownership/role |
| Audit logs | Immutable, write-only |

### 7.3 Evidence Chain of Custody

```typescript
interface ChainOfCustody {
  photoId: string;
  events: ChainEvent[];
}

interface ChainEvent {
  timestamp: Date;
  action: 'CAPTURED' | 'UPLOADED' | 'VIEWED' | 'DOWNLOADED' | 'INCLUDED_IN_REPORT';
  userId: string;
  userName: string;
  deviceInfo?: string;
  ipAddress?: string;
  hashAtTime?: string;  // Verify integrity
  notes?: string;
}
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Goal**: Core infrastructure and basic web app

- [ ] Project setup (Next.js, Tailwind, Prisma)
- [ ] Database schema implementation
- [ ] Authentication system
- [ ] Basic dashboard
- [ ] Report CRUD operations
- [ ] Photo upload (web)
- [ ] Basic PDF generation

**Deliverable**: Working web app for creating reports

### Phase 2: Report Builder (Weeks 5-8)
**Goal**: Complete report editing experience

- [ ] Multi-step report wizard
- [ ] Defect management
- [ ] Roof element tracking
- [ ] Photo annotation tool
- [ ] Compliance checklists
- [ ] Auto-save functionality
- [ ] Professional PDF output

**Deliverable**: Full report creation workflow

### Phase 3: Mobile App (Weeks 9-12)
**Goal**: On-site capture capability

- [ ] React Native / Expo setup
- [ ] Camera integration with EXIF
- [ ] GPS tracking
- [ ] Offline storage (SQLite)
- [ ] Sync engine
- [ ] Voice notes
- [ ] Photo quick-tagging

**Deliverable**: Mobile app for field use

### Phase 4: Review & Quality (Weeks 13-16)
**Goal**: Review workflow and quality assurance

- [ ] Review workflow
- [ ] Inspector management (admin)
- [ ] Report templates
- [ ] Batch operations
- [ ] Analytics dashboard
- [ ] Audit trail viewing
- [ ] Evidence integrity verification

**Deliverable**: Complete platform with review workflow

### Phase 5: Polish & Launch (Weeks 17-20)
**Goal**: Production readiness

- [ ] Performance optimisation
- [ ] Security audit
- [ ] Accessibility audit
- [ ] User acceptance testing
- [ ] Documentation
- [ ] Training materials
- [ ] Pilot with 3-5 inspectors

**Deliverable**: Production-ready platform

---

## 9. Cost Estimates

### Development Costs (Indicative)

| Phase | Effort | Cost Range (NZD) |
|-------|--------|------------------|
| Phase 1: Foundation | 4 weeks | $20,000 - $35,000 |
| Phase 2: Report Builder | 4 weeks | $25,000 - $40,000 |
| Phase 3: Mobile App | 4 weeks | $30,000 - $50,000 |
| Phase 4: Review & QA | 4 weeks | $20,000 - $35,000 |
| Phase 5: Polish & Launch | 4 weeks | $15,000 - $25,000 |
| **Total Development** | **20 weeks** | **$110,000 - $185,000** |

### Ongoing Costs (Monthly)

| Service | Estimated Cost |
|---------|----------------|
| Hosting (Vercel Pro) | $20 - $50 |
| Database (Supabase/Neon) | $25 - $100 |
| File Storage (R2/S3) | $20 - $100 |
| Email (Resend/SendGrid) | $20 - $50 |
| Monitoring (Sentry) | $30 - $100 |
| **Total Monthly** | **$115 - $400** |

---

## 10. Success Metrics

### Platform Metrics
- Report completion time (target: < 2 hours post-inspection)
- Photo sync success rate (target: > 99%)
- PDF generation reliability (target: > 99.5%)
- User satisfaction score (target: > 4.5/5)

### Business Metrics
- Number of active inspectors
- Reports generated per month
- Average defects documented per report
- Report reuse rate (templates)
- Revenue from non-member reports

### Quality Metrics
- Reports accepted by Disputes Tribunal (target: 100%)
- LBP Board complaint success rate
- Court citation rate
- Inspector feedback score

---

## Appendix A: Code Reference Standards

### Building Code References
- NZBC Clause E2 External Moisture
- NZBC Clause B2 Durability
- E2/AS1 4th Edition (from 28 July 2025)
- NZS 3604:2011 Timber Framed Buildings

### Industry Standards
- NZ Metal Roof and Wall Cladding Code of Practice v25.12
- AS 4349.1 Pre-purchase Building Inspections
- ISO/IEC 17020:2012 Inspection Bodies
- ISO 9001:2015 Quality Management
- ISO 19011:2018 Auditing

### Legal Requirements
- Evidence Act 2006 (Section 25, Section 137)
- High Court Rules Schedule 4 (Expert Witnesses)
- Building Act 2004 (Section 317)
- NZ Plain Language Act 2022

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **E2** | Building Code Clause for External Moisture |
| **B2** | Building Code Clause for Durability |
| **COP** | Code of Practice |
| **LBP** | Licensed Building Practitioner |
| **EXIF** | Exchangeable Image File Format (photo metadata) |
| **Chain of Custody** | Documentation tracking evidence handling |
| **ISO 17020** | International standard for inspection bodies |
| **AS 4349.1** | Australian standard for building inspections |

---

*Document Version: 1.0*
*Created: January 2025*
*For: RANZ Executive*
