# repaircameras.org
A site to hold knowledge on camera repair

## Prerequisites

- Node.js (see `.nvmrc` for version)

## Main site

```bash
# Install dependencies
npm install

# Start development server with live reload
npm start

# Build for production
npm run build
```

The site is built with [Eleventy](https://www.11ty.dev/) and outputs to `_site/`.

## Admin SPA

The admin interface lives in `admin/` and is a React app built with Vite.

```bash
cd admin
npm install
cp .env.example .env  # fill in GitHub OAuth credentials

# Start dev server (Vite on :5173 + OAuth proxy on :8788)
npm run dev

# Run tests
npm test

# Build for production (outputs to site/admin/)
npm run build
```

You can also run admin commands from the root:

```bash
npm run admin:dev
npm run admin:test
npm run admin:build
```

### GitHub OAuth setup

To use the admin locally you need a GitHub OAuth app:

1. Go to https://github.com/settings/developers and create a new OAuth app
2. Set the homepage URL to `http://localhost:5173/admin/`
3. Set the callback URL to `http://localhost:5173/admin/`
4. Copy the client ID and secret into `admin/.env`
