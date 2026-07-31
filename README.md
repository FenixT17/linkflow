# LinkFlow

A premium, glassmorphism Link-in-Bio SaaS built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui and Framer Motion.

## Features

- Premium dark-first glassmorphism UI
- Responsive landing page
- Authentication screens (login / register)
- Dashboard with sidebar navigation and mobile menu
- Visual link editor with drag-and-drop reordering
- Live phone preview
- Analytics page with charts
- Public profile page (`/[username]`)
- Appearance, profile and settings pages
- Dark / light theme support via `next-themes`

## Tech Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Framer Motion
- @dnd-kit (sortable links)
- Recharts (analytics)
- Appwrite (ready to connect)
- TanStack Query, React Hook Form, Zod

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## Appwrite Setup

Copy `.env.example` to `.env.local` and set your Appwrite endpoint, project and database IDs.

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE=your_database_id
```

## Project Structure

```
src/
  app/            # Next.js App Router pages
  components/     # Shared UI and dashboard components
  lib/            # Utilities, types, Appwrite client
  hooks/          # Custom React hooks
```
