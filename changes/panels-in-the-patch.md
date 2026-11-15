### Added

- **Panels in the patch** (decision 007; rung 5 of the control surfaces' proposal). A setup names its active panels (`Setup.panels`, optional; `withPanelActive`, `panelsOf`, `panelKey`, `isPanelKey`); `panelForwardsOf` says which panels a row's message goes to; `PanelRack` (`@yggi/webmidi/panels`) keeps a runtime for each, and `PanelRuntime.watch` tells a view when a value changes; `localPanelStore` (`@yggi/webmidi/web`) keeps the library in `localStorage`. `PatchMatrix` takes `panels` (the library's, by id and name) and `onpanel`: active panels are rows (routed like an input's) and columns (an input's or a panel's row crossed on or off), the others chips that add them. `PanelView` takes a `runtime` in place of a `panel`, to draw one the frontend keeps. `MatrixRow.kind` gains `'panel'`. A frontend that passes no `panels` sees no change, and `forwardsOf` sends nothing to a panel's column. Nothing existing changes on the wire.

### Repository

- **`site/`, the standalone patchbay page** (the patchbay's proposal, section 4): the connection, the setups, the patch and the panels on a page of their own, kept in `localStorage`. `npm run site` serves it and `npm run site:build` builds it; `.github/workflows/site.yml` publishes it on GitHub Pages, run by hand only. Not in the package. `vite` is now a dev dependency by name (8.3.8; it was there through vitest).
