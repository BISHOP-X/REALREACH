# RealReach

RealReach is a mobile-first marketplace for genuine human attention. Nigerian businesses create campaigns around verified participation, while earners discover clear opportunities and build a trusted platform history.

This repository currently contains the production-ready frontend concept. Authentication, campaign persistence, verification, payments, and withdrawals are represented as realistic product flows but are not connected to a backend yet.

## Stack

- React 19
- TypeScript
- Vite
- Custom responsive design system
- Vercel deployment

## Local development

```bash
npm install
npm run dev
```

Run `npm run build` for a production build.

## Current routes

- `/` — marketing website
- `/signup` — earner and business signup flows
- `/login` — role-aware login
- `/earn` — interactive earner dashboard concept
- `/business` — interactive business dashboard concept

The account forms intentionally route into the appropriate demo dashboard until the Supabase backend is added.
