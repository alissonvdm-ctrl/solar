# SolarSim

## Overview

SolarSim is a mobile application built with Expo/React Native that helps users design and simulate solar panel installations on building rooftops. The app integrates with Google's Solar API to provide real-world solar radiation data, offers interactive 2D and 3D roof visualization with panel placement, performs energy generation calculations, and exports professional PDF reports for quoting purposes. The entire UI is in Brazilian Portuguese (pt-BR).

Key features:
- **Map-based location selection** using device GPS and Google Maps for geolocation
- **Roof tracing on map** — draw roof outline on satellite map to auto-measure dimensions (like Google Maps measurement tool)
- **Solar potential analysis** via Google Solar API (sunshine hours, radiation flux, carbon offset)
- **Interactive roof visualization** in both 2D (SVG-based) and 3D (Three.js via WebView)
- **Dynamic panel placement** — auto-place panels or toggle individual positions on/off
- **Real-time energy calculations** based on panel count, location latitude, roof tilt, and solar data
- **PDF report generation** with building specs, energy data, and panel layout diagrams
- **Local simulation persistence** using AsyncStorage (save, load, delete simulations)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54 with expo-router v6 for file-based routing
- **Navigation**: Four main screens — `index` (simulation list), `map` (location picker), `roof-trace` (draw roof outline on satellite map), `simulation` (main editor)
- **State management**: Local React state per screen; React Query (`@tanstack/react-query`) configured for server data fetching
- **Fonts**: Inter font family loaded via `@expo-google-fonts/inter`
- **UI approach**: Custom components with StyleSheet, no UI library. Dark theme defined in `constants/colors.ts`
- **Platform handling**: Separate implementations for web vs native where needed (e.g., `NativeMap.tsx` vs `NativeMap.web.tsx`). The map uses `react-native-maps` on native and falls back to manual lat/lng input on web
- **3D visualization**: Three.js rendered inside a `react-native-webview` WebView (see `ThreeDRoofView.tsx`). The HTML is generated dynamically as a string
- **2D visualization**: SVG-based roof view using `react-native-svg` (see `RoofView.tsx`, `CompassRose.tsx`)

### Backend (Express server)
- **Runtime**: Express 5 running as a Node.js server (`server/index.ts`)
- **Primary purpose**: Acts as an API proxy to Google Solar API (hides API key from client) and serves the static web build in production
- **API endpoint**: `GET /api/solar-data?lat=X&lng=Y` — fetches building solar insights from Google Solar API
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost
- **Development**: `tsx` for TypeScript execution; `esbuild` for production bundling

### Data Storage
- **Client-side persistence**: `@react-native-async-storage/async-storage` — all simulations are stored locally on-device as JSON (see `lib/storage.ts`)
- **Database schema**: A PostgreSQL schema exists in `shared/schema.ts` using Drizzle ORM with a basic `users` table, but it is not actively used by the current application logic. The server uses in-memory storage (`MemStorage` class in `server/storage.ts`)
- **Drizzle config**: Points to `DATABASE_URL` environment variable for PostgreSQL; migrations output to `./migrations`

### Key Libraries & Patterns
- **Solar calculations** (`lib/solar-utils.ts`): Pure functions for peak sun hours, solar irradiance, tilt factor, energy generation, and auto-panel placement based on building dimensions
- **Geo calculations** (`lib/geo-utils.ts`): Haversine distance, polygon area, bounding box dimensions, centroid — used by roof tracing to convert GPS coordinates to real-world meters
- **Roof tracing** (`components/RoofTraceMap.tsx` / `.web.tsx`): Google Maps JS API rendered in WebView/iframe for drawing roof outline with distance labels and area overlay. Platform-specific implementations (WebView for native, iframe for web)
- **Report generation** (`lib/report-html.ts`): Generates a full HTML document used by `expo-print` to create PDFs, shared via `expo-sharing`
- **Types** (`lib/types.ts`): Central type definitions for Simulation, BuildingConfig, PanelPosition, EnergyData, SolarApiData with panel dimension constants
- **Error handling**: Custom `ErrorBoundary` class component with `ErrorFallback` UI

### Build & Deployment
- **Dev workflow**: Two parallel processes — `expo:dev` for the mobile/web client, `server:dev` for the Express backend
- **Production build**: Custom `scripts/build.js` handles static Expo web export; `server:build` uses esbuild to bundle the server
- **Replit integration**: Environment variables `REPLIT_DEV_DOMAIN`, `EXPO_PUBLIC_DOMAIN` used for URL configuration; landing page template at `server/templates/landing-page.html`

## External Dependencies

### APIs & Services
- **Google Solar API**: Used to fetch building solar insights (sunshine hours, radiation flux, roof segments, carbon offset). Requires `GOOGLE_API_KEY` environment variable on the server
- **Google Maps**: Used for satellite map view on native platforms via `react-native-maps`, for satellite imagery in 3D view via Static Maps API, and for roof tracing via Google Maps JavaScript API

### Database
- **PostgreSQL**: Configured via Drizzle ORM (`drizzle.config.ts`) using `DATABASE_URL` environment variable. Schema defines a `users` table but is not yet integrated into the main app flow. The server currently uses in-memory storage

### Key npm Dependencies
- `expo` ~54.0.27, `react-native` 0.81.5, `react` 19.1.0
- `expo-router` ~6.0.17 (file-based routing)
- `@tanstack/react-query` ^5.83.0 (data fetching)
- `react-native-maps` ^1.18.0 (native map component)
- `react-native-webview` (3D rendering host)
- `react-native-svg` (2D roof visualization)
- `expo-location` (GPS permissions and geolocation)
- `expo-print` / `expo-sharing` (PDF generation and sharing)
- `expo-haptics` (tactile feedback)
- `drizzle-orm` ^0.39.3 / `drizzle-zod` ^0.7.0 (ORM, not actively used)
- `express` ^5.0.1 (backend server)
- `pg` ^8.16.3 (PostgreSQL driver)

### Environment Variables
- `GOOGLE_API_KEY` — Required for Google Solar API and Maps Static API
- `DATABASE_URL` — Required for Drizzle/PostgreSQL (if database features are enabled)
- `REPLIT_DEV_DOMAIN` / `EXPO_PUBLIC_DOMAIN` — Used for development URL routing on Replit