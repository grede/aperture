# Aperture Web GUI

Modern web-based interface for managing app store screenshots with AI-powered localization.

## Architecture

```
src/web/
├── app/                    # Next.js App Router (pages + API routes)
├── components/             # React components (UI + app-specific)
├── lib/                    # Core utilities (db, storage, constants, validators)
├── services/               # Service layer (wraps existing Aperture code)
└── types/                  # TypeScript type definitions
```

## Key Design Principles

### 1. Code Reuse
- **No duplication**: Wraps existing `TemplateEngine` and `TranslationService`
- **Shared types**: Reuses types from `src/types/index.ts`
- **Clean separation**: Web code in `src/web/`, CLI code in `src/cli/`

### 2. Service Layer Pattern
```typescript
// services/template.service.ts
import { TemplateEngine } from '../../templates/engine.js';

export class TemplateService {
  private engine = new TemplateEngine();

  async generateScreenshot(/* ... */) {
    return this.engine.composite({ /* ... */ });
  }
}
```

### 3. Database Layer
- **SQLite**: Zero configuration, file-based database
- **Prepared statements**: Security and performance
- **Foreign keys**: Cascading deletes for data integrity
- **WAL mode**: Better concurrency

### 4. API Design
- **RESTful**: Resource-oriented URLs
- **Consistent responses**: `{ success: boolean, data?: any, error?: string }`
- **Validation**: Zod schemas for all requests
- **Error handling**: Centralized error handler

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/apps` | GET | List all apps |
| `/api/apps` | POST | Create app |
| `/api/apps/:id` | GET/PUT/DELETE | Get/update/delete app |
| `/api/apps/:id/screens` | POST | Add screen (with file upload) |
| `/api/screens/:id` | PUT/DELETE | Update/delete screen |
| `/api/apps/:id/copies` | GET/PUT | Get/batch update copies |
| `/api/copies/generate` | POST | AI translation |
| `/api/apps/:id/generate` | POST | Start generation |
| `/api/generations/:id` | GET | Get generation results |
| `/api/generations/:id/status` | GET | Poll generation status |
| `/api/templates/preview` | POST | Generate template preview |

## Database Schema

```sql
apps                     -- Core app entity
  ├── screens            -- Screenshots per device
  │   └── copies         -- Marketing text per locale
  └── generations        -- Screenshot generation runs
      └── generated_screenshots -- Output files
```

## User Workflows

### Workflow 1: Create App
1. Navigate to home page
2. Click "Create New App"
3. Enter app name and description
4. Click "Create App"

### Workflow 2: Upload Screenshots
1. Open app details
2. Upload screenshot files
3. Select device type for each (iPhone, iPad, Android phone/tablet)
4. Add title and subtitle (English)
5. Repeat for all screens

### Workflow 3: Manage Copies
1. Click "Manage Copies"
2. Switch between language tabs
3. Edit titles and subtitles for each screen
4. Or click "Generate with AI" to auto-translate

### Workflow 4: Generate Screenshots
1. Click "Generate Screenshots"
2. Select devices (filtered by uploaded screenshots)
3. Choose frame mode (none/minimal/realistic)
4. Select target languages (filtered by available copies)
5. Pick template style (minimal/modern/gradient/dark/playful)
6. Click "Generate"
7. Monitor real-time progress
8. Download generated images

## Development

### Run Development Server
```bash
npm run dev:web
```

### Build for Production
```bash
npm run build:web
```

### Start Production Server
```bash
npm run start:web
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (defaults)
DATABASE_PATH=./aperture-data/aperture.db
UPLOADS_DIR=./aperture-data/uploads
GENERATIONS_DIR=./aperture-data/generations
FRAME_ASSETS_DIR=./templates/assets
```

## Tech Stack

- **Next.js 14**: React framework with App Router
- **Tailwind CSS**: Utility-first CSS
- **shadcn/ui**: High-quality React components
- **better-sqlite3**: Fast SQLite driver
- **Sharp**: Image processing (via TemplateEngine)
- **OpenAI**: AI translation (via TranslationService)
- **Zod**: Schema validation
- **date-fns**: Date formatting

## Performance Considerations

- **Server Components**: Data fetching happens server-side
- **Image Optimization**: Next.js Image component for uploads
- **Polling**: 1-second interval for generation status
- **WAL Mode**: Better database concurrency
- **File Streaming**: Efficient file uploads

## Security

- **Input Validation**: Zod schemas on all API routes
- **Path Sanitization**: Prevents directory traversal
- **SQL Injection**: Prepared statements
- **API Key**: Server-side only, never exposed to client

## Future Enhancements

- [ ] Batch upload multiple screenshots
- [ ] Drag-and-drop reordering
- [ ] Copy from existing app
- [ ] Export all locales as ZIP
- [ ] Webhook notifications when generation completes
- [ ] User authentication
- [ ] Multi-tenant support
- [ ] Real-time updates via WebSocket
