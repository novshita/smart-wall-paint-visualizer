# Smart Wall Paint Visualizer — Technical & Product Specification

**Version:** 1.0 (Phase 1)
**Stack:** MEAN (MongoDB, Express.js, Angular 15+, Node.js)
**Type:** Web-only application (desktop + tablet responsive)

---

## 1. Overview

Smart Wall Paint Visualizer lets users upload a photo of their own room, manually select wall areas, and apply virtual paint colours, dual-tone combinations, or basic patterns to preview the result before painting. It also serves interior designers, painters, and paint retailers during consultations.

The product must work as a complete end-to-end system: Angular frontend, Node/Express REST API, MongoDB database, secure image handling, an admin panel, and a live cloud deployment.

### 1.1 Problem Statement

- Customers cannot accurately visualise the final painted look.
- Shade cards do not reflect real room lighting.
- Wrong choices cause dissatisfaction and repainting costs.
- No easy, user-friendly preview tool exists for ordinary users.

### 1.2 Objectives

**Primary**
1. Preview paint colours on the user's actual room photo.
2. Reduce incorrect paint selection and repainting expense.
3. Increase confidence in interior decisions.
4. Provide a realistic, interactive visualisation experience.

**Secondary**
1. Support designers and painters in consultations.
2. Assist retailers in customer decision-making.
3. Encourage digital adoption in home improvement planning.
4. Demonstrate a practical MEAN stack implementation.

---

## 2. Scope

### 2.1 In Scope (Phase 1)

- Web-based room image upload (JPG/PNG)
- Manual wall selection (brush and polygon tools)
- Virtual paint colour application (solid and dual-tone)
- Basic pattern/wallpaper application
- Opacity and finish/brightness adjustment
- Before/after preview
- Save, reopen, and download designs
- User and Admin roles
- Admin dashboard with analytics

### 2.2 Out of Scope (Phase 1)

- Automatic AI wall detection
- AR/VR live camera preview
- Native mobile application
- Direct paint purchase and payment

---

## 3. Users & Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Guest** | Unauthenticated visitor | View landing page, browse colour library, read How-to guide |
| **User** | Registered homeowner, designer, painter, retailer staff | Upload images, create/edit/save/download projects, manage favourites |
| **Admin** | System manager | Everything a User can do, plus manage colours, patterns, users, view activity, configure system settings |

---

## 4. User Flow

1. Register / log in
2. Upload room image
3. Select wall area(s) with brush or polygon tool
4. Apply paint colour or pattern (browse/search the library)
5. Adjust opacity, finish, and brightness
6. Compare before/after
7. Save project and/or download final image

---

## 5. Application Pages (minimum 6–7 interconnected)

| # | Page | Route | Access | Purpose |
|---|------|-------|--------|---------|
| 1 | Landing / Home | `/` | Public | Product intro, CTA, featured colours |
| 2 | Login / Register | `/auth/login`, `/auth/register` | Public | Authentication |
| 3 | Dashboard | `/dashboard` | User | Recent projects, quick-start upload, favourites |
| 4 | Image Upload | `/projects/new` | User | Upload and validate room photo |
| 5 | Wall Selection | `/projects/:id/select` | User | Brush/polygon selection tools |
| 6 | Colour Preview (Studio) | `/projects/:id/studio` | User | Apply colours/patterns, adjust, compare before/after |
| 7 | Colour Library | `/colors` | Public/User | Browse, filter, search, favourite colours |
| 8 | Saved Designs | `/projects` | User | List, reopen, duplicate, delete, download designs |
| 9 | Profile & Favourites | `/profile` | User | Account details, favourite colours/patterns |
| 10 | How to Use | `/help` | Public | In-app tutorial and disclaimer |
| 11 | Admin Panel | `/admin/*` | Admin | Colours, patterns, users, activity, settings, analytics |

---

## 6. Functional Requirements

### 6.1 Authentication & Accounts

| ID | Requirement |
|----|-------------|
| FR-A1 | Users can register with name, email, and password. |
| FR-A2 | Users can log in and log out; sessions use JWT. |
| FR-A3 | Passwords are hashed (bcrypt) and never returned by the API. |
| FR-A4 | Role-based route guards (Angular) and middleware (Express) separate User and Admin access. |
| FR-A5 | Users can update profile details and change password. |

### 6.2 Image Upload

| ID | Requirement |
|----|-------------|
| FR-U1 | Accept JPG/PNG only; max file size 10 MB (configurable by admin). |
| FR-U2 | Validate MIME type and file signature on the server, not just the extension. |
| FR-U3 | Show upload progress and a preview; reject invalid files with a clear message. |
| FR-U4 | Display an ownership notice: users must upload only images they own. |
| FR-U5 | Resize large images client-side to a working resolution (e.g., max 2000 px longest edge) for performance, while preserving the original on the server. |

### 6.3 Wall Selection

| ID | Requirement |
|----|-------------|
| FR-W1 | **Polygon tool:** click to place vertices, close shape, drag vertices to edit. |
| FR-W2 | **Brush tool:** paint a selection mask with adjustable brush size; eraser mode to subtract. |
| FR-W3 | Support multiple wall regions per project, each independently named and styled (e.g., "Left wall", "Accent wall"). |
| FR-W4 | Undo/redo, clear selection, zoom and pan for precision. |
| FR-W5 | Selections remain editable after saving. |
| FR-W6 | Optional edge feathering (soft edge) setting to blend painted area naturally. |

### 6.4 Colour & Design Application

| ID | Requirement |
|----|-------------|
| FR-C1 | Apply a solid colour from the library or a custom HEX/colour picker value. |
| FR-C2 | **Dual-tone walls:** assign two colours to one region with a split direction (horizontal/vertical) and adjustable split position. |
| FR-C3 | Apply basic patterns/wallpapers with adjustable scale and rotation. |
| FR-C4 | Adjust opacity (0–100%), brightness, and finish (matte, satin, glossy) per region. |
| FR-C5 | Rendering preserves the original photo's shadows and highlights so the result looks like paint, not a flat overlay (see §8). |
| FR-C6 | Multiple design trials per image (variants) that can be switched and compared. |
| FR-C7 | Before/after view: slider comparison and toggle. |
| FR-C8 | Show colour name, code, and brand for each applied colour. |

### 6.5 Colour Library

| ID | Requirement |
|----|-------------|
| FR-L1 | Browse by colour family (reds, blues, greens, neutrals, etc.) shown as a swatch grid. |
| FR-L2 | Search by name, code, or HEX. |
| FR-L3 | Filter by brand, finish, and category tags (e.g., Living Room, Bedroom, Accent). |
| FR-L4 | Swatch detail view with name, code, HEX/RGB, finishes, and a "Try on my room" action. |
| FR-L5 | Users can favourite colours and patterns. |
| FR-L6 | Recently used colours are shown in the studio for quick re-selection. |

### 6.6 Save, Export & Manage

| ID | Requirement |
|----|-------------|
| FR-S1 | Save project (original image ref, selections, applied styles, variants). |
| FR-S2 | Auto-save drafts periodically while editing. |
| FR-S3 | Download final image as PNG or JPG, optionally with colour name/code caption. |
| FR-S4 | Saved Designs page: thumbnail grid, rename, duplicate, delete, reopen. |
| FR-S5 | Export a side-by-side before/after image. |

### 6.7 Admin Features

| ID | Requirement |
|----|-------------|
| FR-AD1 | CRUD for paint colours (name, HEX/RGB, brand, finishes, tags, swatch). |
| FR-AD2 | CRUD for patterns/wallpapers (name, description, category, texture image, scaling info). |
| FR-AD3 | Bulk import colours via CSV/JSON. |
| FR-AD4 | View users, activate/deactivate accounts, change roles. |
| FR-AD5 | View user activity and saved designs (read-only). |
| FR-AD6 | System configuration: max upload size, allowed formats, default finishes, disclaimer text. |
| FR-AD7 | Analytics dashboard with KPIs (see §14). |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Usability** | Simple, intuitive UI usable by non-technical people; guided first-run tour. |
| **Responsiveness** | Desktop and tablet layouts; touch-friendly selection tools. |
| **Performance** | Colour changes re-render in under 300 ms for a 2000 px image; initial page load under 3 s on broadband. |
| **Security** | See §12. |
| **Availability** | Target 99.5% uptime on managed hosting. |
| **Accessibility** | WCAG 2.1 AA targets: keyboard navigation, contrast, labels, alt text. |
| **Browser support** | Latest two versions of Chrome, Edge, Firefox, Safari. |
| **Maintainability** | Modular architecture, clean code standards (ESLint + Prettier), documented APIs. |

---

## 8. Rendering Approach (Core Technical Design)

The visual quality of the product depends on how paint is blended with the photo.

1. **Layers (HTML5 Canvas):**
   - Base layer: original photo
   - Mask layer: wall selection (from polygon/brush)
   - Paint layer: colour or pattern clipped to mask
   - Composite layer: final blended output
2. **Realistic blending:** convert the selected pixels to luminance, then recolour by combining the target hue/saturation with the original luminance (e.g., `multiply` / `color` / `soft-light` composite blend modes, or per-pixel HSL luminance transfer). This keeps shadows, highlights, and wall texture.
3. **Finish simulation:** matte reduces specular highlights; glossy boosts highlight contrast slightly.
4. **Edge handling:** optional feathering using a blurred mask edge.
5. **Performance:** use `OffscreenCanvas` / Web Worker for heavy pixel operations where supported; re-render only the changed region; debounce slider input.
6. **Export:** render the composite at original resolution from stored parameters, not from the downscaled preview.
7. **Disclaimer:** results vary with lighting, screen calibration, and wall texture; this must be displayed in the studio and on exports' help text.

---

## 9. Data Model (MongoDB / Mongoose)

### 9.1 `users`

```json
{
  "_id": "ObjectId",
  "name": "String (required)",
  "email": "String (unique, required, lowercase)",
  "passwordHash": "String (required)",
  "role": "'user' | 'admin' (default 'user')",
  "permissions": ["String"],
  "isActive": "Boolean (default true)",
  "favoriteColors": ["ObjectId -> colors"],
  "favoritePatterns": ["ObjectId -> patterns"],
  "lastLoginAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.2 `projects`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId -> users (indexed)",
  "title": "String",
  "originalImage": { "url": "String", "storageKey": "String", "width": "Number", "height": "Number", "mimeType": "String", "sizeBytes": "Number" },
  "thumbnailUrl": "String",
  "variants": [
    {
      "variantId": "String",
      "name": "String",
      "regions": [
        {
          "regionId": "String",
          "name": "String",
          "selection": { "type": "'polygon' | 'mask'", "points": [[ "Number", "Number" ]], "maskUrl": "String", "feather": "Number" },
          "style": {
            "mode": "'solid' | 'dual' | 'pattern'",
            "colorId": "ObjectId -> colors",
            "secondaryColorId": "ObjectId -> colors",
            "customHex": "String",
            "patternId": "ObjectId -> patterns",
            "split": { "direction": "'horizontal' | 'vertical'", "position": "Number" },
            "opacity": "Number (0-100)",
            "brightness": "Number",
            "finish": "'matte' | 'satin' | 'glossy'",
            "patternScale": "Number",
            "patternRotation": "Number"
          }
        }
      ],
      "renderUrl": "String"
    }
  ],
  "status": "'draft' | 'saved'",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.3 `colors`

```json
{
  "_id": "ObjectId",
  "code": "String (unique)",
  "name": "String",
  "hex": "String",
  "rgb": { "r": "Number", "g": "Number", "b": "Number" },
  "brand": "String",
  "family": "String (e.g., 'Blue', 'Neutral')",
  "finishes": ["'matte' | 'satin' | 'glossy'"],
  "tags": ["String"],
  "swatchUrl": "String",
  "isActive": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.4 `patterns`

```json
{
  "_id": "ObjectId",
  "name": "String",
  "description": "String",
  "category": "String (e.g., 'Floral', 'Geometric')",
  "imageUrl": "String",
  "tileSize": { "width": "Number", "height": "Number" },
  "isActive": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.5 `activity_logs`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "action": "'login' | 'upload' | 'save' | 'download' | 'delete' | ...",
  "projectId": "ObjectId (optional)",
  "metadata": "Object",
  "sessionId": "String",
  "createdAt": "Date"
}
```

### 9.6 `settings`

```json
{
  "_id": "ObjectId",
  "key": "String (unique)",
  "value": "Mixed",
  "updatedBy": "ObjectId -> users",
  "updatedAt": "Date"
}
```

### 9.7 `feedback`

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "projectId": "ObjectId (optional)",
  "rating": "Number (1-5)",
  "comment": "String",
  "createdAt": "Date"
}
```

**Indexes:** `users.email` (unique), `projects.userId + updatedAt`, `colors.code` (unique), text index on `colors.name/code`, `colors.family`, `colors.brand`, `activity_logs.createdAt`.

**Image storage:** files live in object storage (e.g., AWS S3, or local disk in development); MongoDB stores URLs, keys, and metadata only.

---

## 10. REST API

Base path: `/api/v1`. JSON responses; standard error shape `{ "status": <code>, "message": "...", "errors": [] }`.

### 10.1 Auth

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/register` | Public | Register user |
| POST | `/auth/login` | Public | Log in, returns JWT |
| POST | `/auth/logout` | User | Invalidate session client-side / server log |
| GET | `/auth/me` | User | Current user profile |
| PATCH | `/auth/me` | User | Update profile |
| PATCH | `/auth/password` | User | Change password |

### 10.2 Projects

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/projects` | User | Create project with image upload (multipart) |
| GET | `/projects` | User | List own projects (paginated) |
| GET | `/projects/:id` | Owner/Admin | Get project |
| PUT | `/projects/:id` | Owner | Update selections/variants/styles |
| POST | `/projects/:id/duplicate` | Owner | Duplicate project |
| POST | `/projects/:id/render` | Owner | Upload final render image |
| DELETE | `/projects/:id` | Owner/Admin | Delete project |

### 10.3 Colours & Patterns

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/colors` | Public | List/search/filter (`q`, `family`, `brand`, `finish`, `tag`, `page`) |
| GET | `/colors/:id` | Public | Colour detail |
| POST | `/colors` | Admin | Create |
| PUT | `/colors/:id` | Admin | Update |
| DELETE | `/colors/:id` | Admin | Remove (soft-delete) |
| POST | `/colors/import` | Admin | Bulk import CSV/JSON |
| GET | `/patterns` | Public | List/filter patterns |
| POST/PUT/DELETE | `/patterns[/:id]` | Admin | Manage patterns |

### 10.4 Favourites

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/me/favorites` | User | Get favourite colours/patterns |
| POST | `/me/favorites/colors/:id` | User | Add favourite colour |
| DELETE | `/me/favorites/colors/:id` | User | Remove favourite colour |
| POST/DELETE | `/me/favorites/patterns/:id` | User | Add/remove favourite pattern |

### 10.5 Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List users |
| PATCH | `/admin/users/:id` | Change role / activate / deactivate |
| GET | `/admin/projects` | View all saved designs |
| GET | `/admin/activity` | Activity logs |
| GET/PUT | `/admin/settings` | Read/update system settings |
| GET | `/admin/analytics` | KPI aggregates |

### 10.6 Feedback & Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/feedback` | Submit satisfaction feedback |
| POST | `/activity` | Log client events (session start/end) |

API documentation is published via Swagger/OpenAPI at `/api/docs`.

---

## 11. System Architecture

```
┌──────────────┐    HTTPS     ┌─────────────────────┐     ┌───────────────┐
│  Angular SPA │ ───────────▶ │  Express REST API   │ ──▶ │   MongoDB     │
│  (Canvas/SVG)│ ◀─────────── │  (JWT, validation)  │     │ (Atlas)       │
└──────────────┘              └──────────┬──────────┘     └───────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │ Object storage (S3) │
                              │  images / renders   │
                              └─────────────────────┘
```

### 11.1 Frontend Structure (Angular 15+)

```
src/app/
├── core/            # auth service, interceptors, guards, config
├── shared/          # UI components, pipes, directives, models
├── features/
│   ├── landing/
│   ├── auth/
│   ├── dashboard/
│   ├── upload/
│   ├── wall-selection/   # canvas tools: polygon, brush, eraser
│   ├── studio/           # rendering engine, controls, before/after
│   ├── colors/           # library, swatch detail, favourites
│   ├── projects/         # saved designs
│   ├── profile/
│   ├── help/
│   └── admin/            # colours, patterns, users, activity, settings, analytics
└── app-routing.module.ts  # lazy-loaded feature modules
```

- Lazy-loaded modules per feature; standalone canvas/rendering service isolated from UI.
- State: Angular services with RxJS (NgRx optional for studio state if complexity warrants).
- Styling: SCSS with design tokens (colours, spacing, typography) and responsive breakpoints.

### 11.2 Backend Structure (Node/Express)

```
server/
├── src/
│   ├── config/        # env, db, storage
│   ├── models/        # Mongoose schemas
│   ├── routes/
│   ├── controllers/
│   ├── services/      # business logic, image processing
│   ├── middleware/    # auth, role check, validation, error handler, rate limit, upload
│   ├── utils/
│   └── app.js / server.js
├── tests/
└── .env.example
```

---

## 12. Security Requirements

- Passwords hashed with bcrypt (cost ≥ 10); JWT with expiry (e.g., 1 h access token; optional refresh token via httpOnly cookie).
- Input validation and sanitisation on every endpoint (e.g., Joi / express-validator).
- File upload hardening: MIME + magic-byte checks, size limits, randomised filenames, no direct execution paths, image re-encoding to strip embedded payloads/EXIF location data.
- Authorisation: users can only access their own projects; admin routes require role check.
- Protections: Helmet headers, CORS allow-list, rate limiting on auth and upload routes, NoSQL-injection sanitisation, XSS-safe rendering.
- HTTPS enforced in deployment; secrets only in environment variables.
- Privacy: users upload only images they own; users can delete projects and images permanently; images are private by default (signed URLs).

---

## 13. UI/UX Guidelines

- **Original design:** the colour library follows a familiar browse-by-family pattern for usability, but layout, branding, and visual language must be our own, not a copy of any existing site.
- Studio layout: large central canvas, left tool rail (select, brush, polygon, eraser, zoom), right panel (colour/pattern picker, opacity, finish, variants), top bar (undo/redo, before/after, save, download).
- Contextual hints and a first-use walkthrough for non-technical users.
- Clear, consistent display of colour name, code, and brand wherever a colour appears.
- Persistent, friendly disclaimer about lighting, screen calibration, and wall texture.
- Empty, loading, and error states for every page.
- Tablet: larger touch targets, pinch-to-zoom and two-finger pan on the canvas.

---

## 14. Analytics & KPIs

| KPI | Source |
|-----|--------|
| Number of room images uploaded | `activity_logs` (upload) / `projects` count |
| Number of designs saved | `projects` with status `saved` |
| Average session duration | Client session start/end events |
| User satisfaction | `feedback` ratings (average, distribution) |

Admin analytics dashboard shows these in near real time (polling or WebSocket/SSE), with date-range filters and top-used colours.

---

## 15. Assumptions & Constraints

**Assumptions**
- Users upload clear, well-lit room photos.
- Manual wall selection is acceptable for Phase 1.
- Users have a modern browser and internet access.

**Constraints**
- Rendering performance depends on image size.
- Limited initial colour/pattern catalogue (seed data).
- No AI automation in this version.

---

## 16. Deployment

| Layer | Recommended Option |
|-------|-------------------|
| Frontend | Vercel or Netlify (or AWS S3 + CloudFront) |
| Backend | AWS (Elastic Beanstalk / EC2 / ECS) or a Node host such as Render |
| Database | MongoDB Atlas |
| Media | AWS S3 (or equivalent) |
| CI/CD | GitHub Actions: lint → test → build → deploy |
| Domain & TLS | Custom domain with HTTPS |

Environments: `development`, `staging`, `production`, each with its own `.env` configuration.

---

## 17. Testing Strategy

- **Unit:** Angular services/components (Jasmine/Karma or Jest); backend services (Jest/Mocha).
- **API/Integration:** Supertest against an in-memory MongoDB.
- **Rendering:** snapshot/visual tests for blending output on reference images.
- **E2E:** Cypress or Playwright covering the full flow (register → upload → select → paint → save → download).
- **Security:** dependency audit, upload-abuse tests, authorisation tests.
- **Usability:** test with non-technical users on desktop and tablet.

---

## 18. Deliverables

1. This specification / PRD
2. Fully functional Angular + Node web application (all in-scope features)
3. Admin dashboard (content and user management)
4. MongoDB schema and seed data (colours, patterns, admin account)
5. User documentation (in-app "How to Use" tutorial)
6. Developer documentation (README, setup, deployment guide, Swagger API docs)
7. Live deployment with domain
8. Analytics dashboard with real-time KPIs

---

## 19. Suggested Milestones

| Phase | Focus | Outcome |
|-------|-------|---------|
| 1 | Project setup, auth, DB schemas, CI | Login/register working, base API |
| 2 | Upload + wall selection tools | Polygon/brush selection with undo/redo |
| 3 | Rendering engine + colour library | Realistic solid-colour preview |
| 4 | Dual-tone, patterns, variants, before/after | Full studio experience |
| 5 | Save/export, saved designs, favourites | End-to-end user flow complete |
| 6 | Admin panel + analytics | Content management and KPI dashboard |
| 7 | Hardening, testing, docs, deployment | Live, documented system |

---

## 20. Acceptance Criteria

- A new user can register, upload a JPG/PNG, select a wall with both tools, apply a colour, compare before/after, save, and download — without instructions beyond the in-app guide.
- Painted walls retain visible shadows and texture from the original photo.
- Dual-tone and pattern application work on at least one region, with multiple regions supported per image.
- Saved projects reopen with selections and styles fully editable.
- Admin can add, edit, and remove colours and patterns, and see the change reflected in the user library immediately.
- Admin dashboard displays all four KPIs.
- Unauthorised access to other users' projects and admin routes is blocked.
- At least 6–7 interconnected pages are functional and fully integrated with the backend and database.
- Application is live on a cloud environment with HTTPS and a domain.

---

## 21. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Slow rendering on large images | Working-resolution downscale, Web Worker/OffscreenCanvas, region-limited redraw |
| Inaccurate manual selection | Zoom/pan, vertex editing, feathering, undo/redo, tutorial |
| Colour appearing unrealistic | Luminance-preserving blend, brightness/opacity controls, disclaimer |
| Malicious uploads | Server-side validation, re-encoding, size limits, private storage |
| Storage cost growth | Image size caps, thumbnails, cleanup of orphaned/draft files |
| Limited catalogue | Admin bulk import, seed with a broad colour set |

---

## 22. Future Enhancements

- AI-based automatic wall detection (segmentation)
- Advanced textures and 3D previews
- Lighting simulation (day/night modes)
- Integration with paint brands and retailers (catalogue sync, purchase links)
- Native mobile app / AR live preview

---

## 23. Project Guidelines (Mandatory Rules)

1. Uploaded room images must be original and owned by the user (no copyright/privacy violations).
2. Users are informed that final results may vary due to lighting, screen calibration, and wall texture.
3. Manual wall selection tools must be simple, accurate, and user-friendly.
4. All colours, shade codes, and designs are clearly defined and applied consistently across previews.
5. The project is web-only, built on the MEAN stack, with clean code standards and modular architecture.
6. A minimum of 6–7 interconnected functional pages (Login, Image Upload, Wall Selection, Colour Preview, Saved Designs, Admin Panel, and more).
7. Image uploads and user data are handled securely, with proper validation and storage.
8. The system is a complete end-to-end solution; frontend, backend, and database are fully integrated.
9. The focus is real-life usability so non-technical users can easily preview and compare paint options before deciding.
10. The Behr colour-browsing site is a reference for UX inspiration only; the design, content, and assets must not be copied.
