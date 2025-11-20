# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

repaircameras.org is a static site built with Eleventy (11ty) that hosts camera repair manuals and resources. The site uses TypeScript, JSX/TSX for templates, and SCSS for styling.

## Common Commands

```bash
# Start development server with live reload
npm start

# Build the site for production
npx @11ty/eleventy
```

## Architecture

### Content Structure

- **Site content**: `site/` directory
  - Camera pages: `site/cameras/{manufacturer}/{model}.md` - Markdown files with frontmatter
  - Manufacturer indexes: `site/cameras/{manufacturer}/index.md`
  - PDF manuals: `site/files/*.pdf` - Service manuals, repair guides, parts catalogs
    - Naming convention: `{manufacturer}-{model}-{document-type}.pdf` (e.g., `pentax-mx-service-manual.pdf`, `nikon-fm2-repair-manual.pdf`)
    - Use kebab-case for all components
  - Static assets: `site/static/`

### Camera Page Frontmatter

Camera markdown files use this structure:
```yaml
---
layout: item.11ty.tsx
tags:
  - cameras
manufacturer: Pentax
model: MX
relatedFiles:
  - pentax-mx-service-manual  # ID without .pdf extension
relatedLinks:
  - pentax-k1000-youtube      # ID from site/_data/links/
---
```

### Templates and Components

- **Layouts**: `_layouts/` - TSX templates using `.11ty.tsx` extension
  - `item.11ty.tsx` - Individual camera pages
  - `manufacturerIndex.11ty.tsx` - Manufacturer listing pages
  - `mainIndex.11ty.tsx` - Main cameras index
  - `content.11ty.tsx` - Generic content pages

- **Components**: `components/` - Reusable TSX components
  - `MainTemplate.tsx` - Base HTML template with header/footer/breadcrumbs
  - `ResourceLink.tsx` - Displays PDF/link thumbnails
  - `Breadcrumbs.tsx` - Navigation breadcrumbs

- **Component imports**: Use `@components/*` path alias (configured in tsconfig.json)

### Data Pipeline

The site uses Eleventy's global data system (`site/_data/`) to process PDFs and external links:

- **`files.js`**: Reads all PDFs from `site/files/`, extracts metadata (title, description) from PDF properties, generates thumbnails at build time, stores in `_site/img/thumbnails/`
- **`links.js`**: Reads JSON files from `site/_data/links/`, pairs with corresponding JPG thumbnails, processes images for display

These data files are available globally in all templates as `files` and `links` objects, keyed by filename (without extension).

### Build Configuration

- **`eleventy.config.js`**: Custom extensions for TSX/SCSS compilation using tsx and sass packages
- **`tsconfig.json`**: JSX configuration with `jsx-async-runtime` for async component rendering
- Output directory: `_site/` (default Eleventy output)

### TypeScript

- Type definitions in `lib/types/`: `File.ts`, `Link.ts`, `PageMetadata.ts`, `ImageMetadata.ts`
- No compilation step needed - tsx handles TypeScript at runtime

## Adding New Content

### Adding a camera page

1. Create `site/cameras/{manufacturer}/{model}.md` with proper frontmatter
2. Add any related PDF files to `site/files/` with descriptive filename (e.g., `pentax-mx-service-manual.pdf`)
3. Reference PDFs in frontmatter `relatedFiles` array using filename without extension
4. PDF metadata (title/description) should be embedded in the PDF itself

### Adding PDF files

1. Place PDF in `site/files/` directory with a descriptive kebab-case filename
2. **Set PDF metadata properties** - the site reads and displays these:
   - **Title**: Displayed as the file title in the UI
   - **Subject**: Displayed as the file description
   - Use a PDF editor to set these properties (e.g., Preview on Mac: Tools → Show Inspector → Description tab)
3. Reference the PDF in camera pages using `relatedFiles` array with filename (no extension)
4. The build process automatically:
   - Extracts title/subject metadata from the PDF
   - Generates a thumbnail from the first page
   - Creates responsive thumbnail images
   - Makes the file available in templates via the global `files` object

### Adding external resources

1. Create `site/_data/links/{id}.json` with structure:
   ```json
   {
     "title": "Video Title",
     "description": "Description",
     "url": "https://..."
   }
   ```
2. Add matching thumbnail as `site/_data/links/{id}.jpg`
3. Reference in camera frontmatter `relatedLinks` array using the ID

## Notes

- The site uses GFDL license
- PDFs are passed through to output without processing
- Thumbnails are generated automatically on first build
- Static images in `site/static/img/` are copied to output
