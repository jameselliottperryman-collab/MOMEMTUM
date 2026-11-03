# Relaywork

A working local project-collaboration prototype, implemented in MOMEMTUM from the supplied Relaywork product brief. The interface uses the brief’s English pilot language and an original visual identity.

## Run

Requires **Node.js 24** (uses built-in `node:sqlite`) and npm.

```sh
npm ci
npm run dev
```

For the optimized local demonstration:

```sh
npm run build
RELAYWORK_DEMO=1 npm start
```

The server uses port 3000 by default. `npm run dev -- --port 3002` selects another port. Fonts are bundled locally; the running application needs no external service or API key.

**This is a demo, not a public SaaS deployment.** Development explicitly enables demo mode. Production startup refuses data access unless `RELAYWORK_DEMO=1` is set. Any visitor in demo mode can choose any sample identity. Cookie sessions and server-side project authorization exercise role behavior, but demo account switching is not production authentication. Use sample data only.

## What works

- Create and switch workspaces; create workspace-visible or restricted projects.
- Board, List, and Overview use the same stored tasks. Drag cards or use the status selector.
- Create and edit tasks, descriptions, multiple assignees, priorities, date-only deadlines, tags, and checklists; managers can archive and restore tasks.
- Combine keyword, assignee, status, priority, and deadline filters; sort and save personal project views in the browser.
- Task comments, activity, assignment/comment inbox updates, read/unread controls, and My Work deadline buckets.
- Keyword/ID search over authorized tasks in the selected workspace.
- Manage explicit access for existing sample collaborators; View, Comment, Edit, and Manage are enforced on the server. Removing a restricted-project grant removes tasks, comments, activity, and inbox targets from subsequent responses. Workspace ownership alone does not reveal restricted content.
- CSV preview validates the entire file before writes. Commit is transactional and an operation ID prevents duplicate retries. Manager-only CSV export escapes spreadsheet formulas.
- Persistent SQLite storage, optimistic task version checks (412 conflicts), input validation, same-origin write checks, HTTP-only session cookies, keyboard-friendly dialogs and a responsive navigation/drawer layout.

### Sample accounts

Use the profile menu at the bottom of the sidebar to switch:

| Account     | Role   | Initial access                         |
| ----------- | ------ | -------------------------------------- |
| Alex Morgan | Owner  | Manages all three sample projects      |
| Nina Patel  | Member | Edits Brand launch and Website refresh |
| Leo Chen    | Member | Edits Brand launch and Website refresh |
| Jordan Lee  | Guest  | Comments on Brand launch only          |

Try moving a task to In review, switching to Jordan to leave feedback, and switching back to Alex to read the inbox. Revoke Jordan in Share, then switch again to confirm the project disappears. No actual invitation emails are sent.

## Data and architecture

Next.js App Router + React + TypeScript; versioned tasks and project-scoped authorization in a Node API; SQLite WAL storage. The local demo stores its state in a transactionally updated document rather than the brief’s eventual relational PostgreSQL model. This is intended for a single local server, not the brief’s scale targets or a stateless/serverless deployment.

Data is created once in `.data/relaywork.sqlite` (ignored by Git), with relative sample deadlines. Set `RELAYWORK_DATA_DIR` to use another writable directory. Retain the database and its WAL files together; use SQLite’s backup tooling for a consistent live backup. Restarting the server preserves tasks and sessions; sessions expire after 24 hours. To start clean without deleting existing data, stop the server and choose a new data directory.

Personal saved views stay in browser local storage. Other clients’ changes become visible on reload; live collaboration and a background notification worker are not connected. Session or grant revocation is enforced on subsequent requests; previously rendered browser content cannot be recalled.

Key files:

- `src/app/page.tsx`: responsive product interface and interactions.
- `src/app/globals.css`: original visual system and responsive styles.
- `src/app/api/[...path]/route.ts`: request validation, task mutations, sharing and CSV.
- `src/lib/model.ts`: shared types, authorization predicates, filtered responses and CSV helpers.
- `src/lib/store.ts`: SQLite transactions, seed fixtures and expiring sessions.

## Validation

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The end-to-end suite starts its own optimized server on port 3001 with a fresh database under `/tmp`; build first and leave that port available. It covers browser task creation, status updates, checklists, comments, view consistency, reload persistence, search, phone navigation, guest restrictions, revocation, tenant boundaries, stale-write rejection, transactional import and retry deduplication. Screenshots are generated under `/tmp`.

Browser tests use `/usr/bin/chromium` when present, or Playwright’s Chromium otherwise. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to override. On another machine, install Chromium with `npx playwright install chromium` if necessary.

## Remaining work before the brief’s pilot

This delivers the core demonstration, **not all MVP acceptance criteria**. Production OIDC identity, email-bound invitations, secure file storage/scanning/downloads, relational PostgreSQL migrations and row policies, a durable outbox/worker, rate limits, reauthentication/audit administration, idempotent task creation, subtasks, typed custom fields, configurable statuses, spaces/folders, project archive controls, follow/mute preferences and paginated APIs remain to implement. The API is internal and not yet a versioned public API. No AI features are implemented.

Before public use: implement production identity and tenancy, remove public demo account switching, test the full policy matrix, add deployment/backup monitoring, and perform accessibility, supported-browser, load and restore validation. No deployment, publication, email delivery, or third-party integration is performed by this repository.

## Native desktop app

Relaywork also runs as a self-contained **Electron desktop application**. The native shell uses the same interface, server-side permissions and SQLite task data model as the web demonstration. It starts and stops its own production Next.js backend on the loopback interface; users of the packaged app do not need Node.js, npm, an Internet connection, or a separately started server.

### Download and run on Linux x64

The generated portable build is `release/Relaywork-0.1.0-linux-x64.tar.gz`, with a matching `.sha256` file. Extract the entire archive and run `Relaywork-linux-x64/relaywork` in a graphical Linux session. Keep the executable alongside its `resources` and Electron libraries. Normal desktop Linux system libraries and Chromium sandbox support are required. The build is unsigned and has no automatic updater.

### Build and launch from source

```sh
npm ci
npm run desktop:build
npm run desktop:start
```

Electron 45 downloads its verified official runtime on first use, or explicitly with `node node_modules/electron/install.js`. Behind an HTTP(S) proxy, use Node 24’s supported `NODE_USE_ENV_PROXY=1` setting for the download/package command. Keep certificate and archive checksum verification enabled.

Create a portable app for the **current operating system and architecture**:

```sh
npm run desktop:package
```

This builds Next.js standalone output, stages the shell and runtime files under `.desktop/app`, and packages them under `release/`. Linux additionally gets a compressed archive and SHA-256 checksum. Windows/macOS packaging should be run on the corresponding OS so traced native dependencies match that platform. Those builds are supported by the source configuration but have not been built or tested here. Signing, notarization, installers and store distribution remain separate work.

### Desktop behavior

- Native File, Edit, View, Window and Help menus; New task (`Ctrl/Cmd+N`), Search (`Ctrl/Cmd+K`), My work (`Ctrl/Cmd+1`), and Inbox (`Ctrl/Cmd+2`).
- Native CSV save dialog, locally bundled fonts and app icons, standard window controls and a single running instance per profile.
- Sandboxed renderer with Node integration disabled, context isolation, a narrow read-only preload bridge, restrictive content policy, denied device permissions, and blocked remote content/webviews. HTTPS links open in the system browser.
- Backend binds only to `127.0.0.1`. A fresh per-launch token is injected by the privileged Electron session and required by the desktop server. It is not exposed to renderer JavaScript. The normal web app does not require this header.
- A stable, saved loopback port preserves the origin for saved browser views. If another process occupies it, Relaywork chooses a free port; tasks remain intact but origin-scoped personal views may need saving again.
- Desktop data is separate from the repository’s web-demo database. It stays on this device; there is no cloud synchronization or cross-device sharing. The desktop version still uses sample identities and must not be treated as production authentication.

Default desktop data directories:

| OS      | Profile                                                          |
| ------- | ---------------------------------------------------------------- |
| Linux   | `~/.config/Relaywork` (or the system Electron app-data location) |
| macOS   | `~/Library/Application Support/Relaywork`                        |
| Windows | `%APPDATA%\Relaywork`                                            |

The database is under `data/relaywork.sqlite` inside the profile. File → Show local data folder opens its directory. Cookies and saved views are retained in the profile. Closing all windows quits the app and its backend on Windows/Linux; on macOS use Quit to exit completely. Installation/builds never copy a personal database, session data or `.env` files into the package. To back up data, quit the app before copying its profile; removing or replacing an extracted application does not remove the profile.

For an isolated test profile set `RELAYWORK_DESKTOP_PROFILE` to an absolute directory. The diagnostic log is `desktop.log` in that profile; startup failures identify that location while preserving the database.

### Native validation

```sh
npm run desktop:build
npm run test:desktop
```

The native test uses Playwright’s Electron driver, an isolated temporary profile, and an actual graphical display. On a headless Linux machine configure a virtual X display and set `DISPLAY`. Its launch flags disable Chromium’s OS sandbox only for this isolated test harness; normal desktop startup does not disable the sandbox. It exercises native menus, task creation, status changes, comments, CSV download, reviewer edit denial, renderer isolation, rejection of unauthenticated loopback requests, data persistence across process restarts, and shutdown of the private backend.

To test the packaged Linux executable with the same workflow:

```sh
RELAYWORK_DESKTOP_EXECUTABLE="$PWD/release/Relaywork-linux-x64/relaywork" npm run test:desktop
```

### Downloadable Windows build on GitHub

The **Windows desktop download** workflow builds on a Windows runner, tests the packaged `relaywork.exe`, and attaches a ZIP and SHA-256 checksum to a GitHub prerelease. It runs after relevant pushes to `main`, or manually from the repository’s Actions tab. Each published tag contains the source commit, so previous downloads remain identifiable.

Open [GitHub releases](https://github.com/jameselliottperryman-collab/MOMEMTUM/releases) and select the **Relaywork … Windows desktop demo** entry. Download `Relaywork-0.1.0-windows-x64.zip`, choose **Extract all**, open the extracted `Relaywork-win32-x64` folder, and run `relaywork.exe`. The complete folder is required. These are unsigned demonstration builds for Windows x64; do not disable Windows security protections to run them. If a build or native test fails, the workflow does not publish a download.

The native Windows packaging command now creates its ZIP and checksum automatically; it is still built and tested on Windows, not cross-compiled from Linux.
