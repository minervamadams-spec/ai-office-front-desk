# Third-party notices

AI Office Front Desk is built with Electron and the following open-source packages bundled into
the shipped application. All are used under the MIT License.

| Package | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop app runtime (Chromium + Node.js) |
| [React](https://react.dev/) | Renderer UI |
| [React DOM](https://react.dev/) | Renderer UI |
| [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) | RSS/Atom feed parsing |

Each package's full license text is included in this app's `node_modules` directory as shipped,
and is available from the linked project pages above. This app does not modify any of these
packages' source.

Development-only tooling (Electron Forge, Vite, TypeScript, Vitest) is used to build and test this
app but is not included in the distributed application.
