# 🔄 Developer Workflows, Branching & Gates

This article outlines our strict Git branching conventions, local machine setup routines, and the **Mental Model Gate** protocol that every developer and AI subagent must pass before implementing features.

---

## 🌿 Git Branching Strategy

To keep our repository stable and ready for release, we follow a rigorous branching strategy. Direct pushes to `main` and `develop` are strictly prohibited.

```
main          ◀── Production-Only. Represents verified, fully-working builds.
 ▲
 └── [PR Only] ─── develop        ◀── Integration branch. All features merge here first.
                    ▲   ▲
                    │   └── [PR Only] ─── fix/*       ◀── Bug fixes against develop.
                    │
                    └── [PR Only] ─────── feature/*   ◀── Feature branch (Phase or card).
```

### 📋 Branch Categorization
* **`main`**: Production release channel. Updated *only* via Pull Requests from `develop` or critical `hotfix/*` branches.
* **`develop`**: The primary integration branch. All active feature work is merged here via Pull Requests.
* **`feature/phase-X-<name>`**: Created for implementing a specific development phase (e.g. `feature/phase-2-journal-entry`). Branched from `develop`.
* **`fix/<bug-description>`**: Used to remediate issues discovered in `develop` (e.g., `fix/trpc-context-null`).
* **`hotfix/<urgency>`**: Direct, emergency fixes branched from `main` to address production crashes, subsequently back-merged into `develop`.

### 🚀 Starting a New Phase or Feature
Run the following sequence to start work on a new phase safely:
```bash
# 1. Align your local develop branch with the remote
git checkout develop
git pull origin develop

# 2. Spawn a cleanly isolated feature branch
git checkout -b feature/phase-3-habits-extraction
```

> **Current branch**: `feature/phase-2-journal-entry` (Phase 2 complete — activity check-in CRUD, pending PR to `develop`)

---

## ⚡ Setup & Execution Reference

### 1. Initial Dependency Sync
```bash
npm install
```

### 2. Environment Configuration
Duplicate the example secrets file and supply your personal credentials (e.g. Gemini key):
```bash
cp .env.example .env
```

### 3. Database Schema Push
Drizzle Kit reads our local schema definition and pushes updates directly into SQLite:
```bash
npm run db:push
```

### 4. Running the Local Development Server
Starts the Next.js Dev Server along with live hot reloading (HMR):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 5. Compiling the Production Build
Validate types, compile assets, and optimize Next.js bundles for deployment:
```bash
npm run build
```

---

## 🚪 The Mental Model Gate Protocol

> [!IMPORTANT]
> **This is a mandatory rule.** Before starting any new phase, writing code for a new feature, or shifting tasks, developers (both humans and AI agents) **must run this protocol**.

### Step 1: In-Depth Study
Open and read `Planning/mental-model.html` in full. Familiarize yourself with the current status of all routes, schemas, and layouts.

### Step 2: State Verification Checklist
Engage with your pair programmer (or explain to the user in chat) to verify that you understand:
* **Request Pipeline**: Can you trace an end-to-end API request from the browser React UI, through the tRPC client hook, the Next.js API handler, the timing middleware, and down into Drizzle ORM?
* **Database Layout**: Do you know what each of the three active tables (`entries`, `habits`, `nudges`) stores and why they are structured as such?
* **Completion Status**: Do you know which parts of the application are stubs, which are finished, and which are scheduled for future phases?
* **AI Hooks**: Do you know exactly where, when, and how the AI extraction layer plugs into our backend mutations?

### Step 3: Explicit Confirmation
**Do not write a single line of feature code until the team explicitly aligns and confirms they understand the current state.**

---

## 🧹 Mental Model Maintenance Rules

Completing any task that adds routers, tables, files, environment variables, or modifies data structures triggers our **Maintenance Protocol**:
1. **Update `Planning/mental-model.html` immediately** after completing the feature work.
2. Mark completed features as `done`, shift progress indicators, and add cards reflecting new routers or components.
3. Keep the file reflecting the absolute truth of the codebase at all times.
