# Queen's AMS Event Finder

An interactive 3D campus map for discovering events at Queen's University.

Instead of browsing a separate event list, the application connects events to the physical campus. Users can search for buildings, events, or organizers, explore the campus on a 3D map, and click buildings to see the events happening there.

## Features

* Interactive 3D Queen's campus map
* Search buildings, events, and organizers
* Filter events by category
* Filter events by time
* View upcoming events
* Click buildings to see associated events
* View event details
* Add, edit, and delete events
* Day and night map modes
* Recenter map controls
* Responsive event panels and search interface
* WebGL fallback when 3D map rendering is unavailable

## Event Search

The search experience works across the campus and event data.

Users can search for:

* Buildings
* Events
* Organizers

Events can also be filtered by:

* Category
* Current status
* Today
* This week

Buildings are highlighted based on the events associated with them.

## 3D Campus Map

The campus map is built with **MapLibre GL JS** and uses 3D building extrusions.

Building footprints are based on OpenStreetMap data.

Clicking a building opens its associated events, including information such as:

* Event name
* Organizer
* Date and time
* Description
* Room/location
* Registration link

## Architecture

```text
React + Vite
      ↓
TanStack Query
      ↓
Express API
      ↓
PostgreSQL
      ↓
Buildings + Events
```

The API is defined using OpenAPI and validated with Zod. The frontend uses generated API hooks to communicate with the backend.

## Tech Stack

* TypeScript
* React
* Vite
* Express
* PostgreSQL
* Drizzle ORM
* Zod
* OpenAPI
* Orval
* TanStack Query
* Tailwind CSS
* shadcn/ui
* MapLibre GL JS
* OpenStreetMap

## Project Structure

```text
artifacts/
├── api-server/
│   └── Express API
│
└── campus-map/
    └── React web application

lib/
├── db/
│   └── Database schema and seed data
│
├── api-spec/
│   └── OpenAPI specification
│
└── api-client-react/
    └── Generated API hooks and schemas
```

## Map Data

The application uses OpenStreetMap building footprints for the campus map.

MapLibre was chosen instead of a standard 2D map because the project is designed around 3D building visualization.

## Running Locally

Install dependencies:

```bash
pnpm install
```

Run the API:

```bash
pnpm --filter @workspace/api-server run dev
```

Run the campus map:

```bash
pnpm --filter @workspace/campus-map run dev
```

Run type checking:

```bash
pnpm run typecheck
```

A PostgreSQL `DATABASE_URL` is required.

## Status

Pilot / actively developed.

---

Built by **Kavin Mohanadas**
