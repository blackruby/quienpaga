# AGENTS.md — LaIsla

## Project Overview

LaIsla is a single-page PWA for managing bar/restaurant consumptions ("comandas"), payments, and statistics. It runs entirely in the browser with no build step.

- **Language**: Vanilla ES5/ES6 JavaScript (no TypeScript, no modules)
- **Styling**: Plain CSS with CSS custom properties
- **Data storage**: Upstash Redis (via REST API) + localStorage for config
- **No build tools, no bundler, no tests**
- **Entry point**: `index.html` loads `script.js` and `styles.css`

## Build / Run / Test

There is no build system. To run the app:

```bash
# Serve locally (any static server works)
npx serve .

# Or open index.html directly in a browser
open index.html
```

No test suite exists. No linting is configured.

## File Structure

```
index.html      — HTML shell + all screen/modal markup (no JS)
script.js       — All application logic (~1800 lines, single file)
styles.css      — All styles (~1170 lines, CSS custom properties)
manifest.json   — PWA manifest
```

## Code Style Guidelines

### General Conventions

- **No TypeScript, no ES modules, no bundler** — write plain JS compatible with modern browsers.
- **No semi-colons required** but existing code uses them inconsistently; match the surrounding file.
- **No linter/formatter** enforced; keep changes consistent with existing style in the file.
- Section headers use box-drawing characters: `// ═══════════════════════════════════════════`.

### Variables & State

- Use `var` for function-scope globals; use `let`/`const` for block-scope inside functions.
- Global state lives at the top of `script.js` (e.g., `CLIENTES`, `PRODUCTOS`, `importes`).
- Private/ephemeral state prefixed with `_` (e.g., `_datosPendientes`, `_comandaActivaKey`).

### Naming Conventions

- **Functions**: `camelCase` (e.g., `cargarDatos`, `confirmarConsumicion`, `verHistorico`)
- **Global vars / constants**: `SCREAMING_SNAKE_CASE` for true constants (e.g., `DB_CONFIGS_KEY`)
- **DOM element IDs**: `kebab-case` (match `id="clientes-tbody"` in HTML)
- **CSS classes**: `kebab-case` (match `.clientes-table`, `.fab-btn`)
- **Language**: Spanish for function/variable names and comments; English for technical terms.

### HTML & DOM

- All screen and modal HTML lives in `index.html` — do not dynamically create full screens via JS.
- Modals are toggled by adding/removing `.open` class on `.modal-overlay` / `.pago-overlay`.
- Use `document.getElementById` for DOM access (no `querySelector` unless dynamic).
- Event handlers attached inline in HTML (e.g., `onclick="nuevaConsumicion()"`) — match existing pattern.
- For `onclick` strings with IDs, use string concatenation: `onclick="selectDb('" + db.id + "')"`.

### CSS

- All styles in `styles.css` — no inline styles except in dynamically generated HTML strings.
- Use CSS custom properties defined in `:root` (e.g., `--accent`, `--surface`).
- Class naming: utility-ish, e.g., `.fab-btn`, `.fab-confirm`, `.action-btn`.
- Prefer class selectors over inline styles for anything reusable.

### Async / Promises

- Use `async/await` for clarity in new code.
- Wrap `fetch` calls in a `dbFetch` helper that adds auth headers automatically.
- Always `.catch` network errors; show user-friendly feedback via `alert` or the `mostrarEstadoCarga` pattern.
- Do not leave unhandled promise rejections.

### Error Handling

- Network errors: `console.error` + user `alert` or inline status message.
- Validation errors: `alert` for user-facing, early `return` for guard clauses.
- Parse errors (`JSON.parse`): wrap in `try/catch`, fall back to defaults.

### Performance

- Avoid touching the DOM inside tight loops — build strings or use `documentFragment`.
- `innerHTML` assignment is acceptable for full-replacement of dynamic content.
- Use `requestAnimationFrame` or CSS animations for transitions; avoid JS-driven animations.

### PWA / Extension

- `manifest.json` defines PWA metadata (name, icons, theme).
- Icons are static PNGs; no icon generation needed.
- The app works offline once loaded (no service worker beyond basic PWA).

## Adding New Features

1. Add new screens/markup to `index.html` inside `#app`.
2. Add corresponding CSS classes to `styles.css`.
3. Add JS functions to `script.js` in the appropriate section.
4. Wire up navigation in the bottom nav or via `showScreen()`.
5. If a new screen needs admin-only visibility, use `updateAdminVisibility()`.
6. Test manually by serving with a static server.

## Common Patterns

**Toggle a modal:**
```js
document.getElementById('modal-overlay').classList.add('open');
pushModalState('my-modal');
```

**Close a modal:**
```js
document.getElementById('modal-overlay').classList.remove('open');
```

**Navigation with history:**
```js
showScreen('screen-productos', 'nav-home');  // adds history entry
showScreen('screen-home', 'nav-home', true); // skips history (e.g., goHome)
```

**API call with auth:**
```js
dbFetch('/get/productos')
  .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(function(data) { /* use data */ })
  .catch(function(err) { console.error(err); alert(err.message); });
```

**Guard clause for no DB selected:**
```js
if (!getSelectedDb()) { showDbManager(); return; }
```
