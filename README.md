# gRPCpeek

gRPCpeek is an open-source desktop client for exploring and testing gRPC services. It combines a Tauri (Rust) backend with a modern React + TypeScript frontend, giving developers a lightweight native experience across macOS, Windows, and Linux.

## Project Vision

Our goal is to deliver a Postman-class workflow for gRPC without the bloat:
- Import proto definitions and build organized collections of services.
- Configure environments (hosts, ports, TLS/auth settings) and reuse them across requests.
- Craft requests with structured metadata, send them instantly, and inspect responses in detail.

## Current Features

### Core Functionality ✅
- **Cross-platform desktop shell** powered by Tauri with Rust async runtime (`tokio`)
- **Proto import & request execution** using the `tonic` gRPC stack—load a proto, invoke RPCs, and inspect responses
- **React/Vite frontend** with modern TypeScript and Tailwind CSS for rapid UI development
- **Unified dev workflow** via `cargo tauri dev`, coordinating the frontend dev server and native shell with hot reload

### Phase 3: Professional UI ✅ (Complete)
- **Modern Design System**: Minimalist aesthetic with custom color tokens and CSS variables
- **Workspace Management**: Multi-environment support with host/port configuration
- **Request Tabs**: Multi-tab interface for parallel testing
- **Service Browser**: Collapsible tree view with method type badges
- **Request/Response Panels**: Side-by-side split view with JSON editors
- **Streaming Support**: Real-time server streaming message display
- **Global Variables**: Workspace-level key-value pairs
- **Request History**: Automatic tracking of all requests
- **Collections**: Save and organize requests
- **Keyboard Shortcuts**: Ctrl+Enter, Ctrl+S, Ctrl+W, Ctrl+Tab, etc.
- **Bundle Size**: 203.57 KB (59.99 KB gzipped)

### Phase 4: UX Enhancements ✅ (Complete)
- **Toast Notifications**: Instant feedback for all actions (copy, save, errors)
- **Command Palette**: Ctrl+K quick navigation with fuzzy search
- **Enhanced Animations**: Smooth transitions, button effects, modal entrance animations
- **Loading Skeletons**: Professional loading states for services and responses
- **Responsive Design**: Mobile-first layout with hamburger menu and collapsible sidebar
- **User Settings**: Customizable theme (light/dark/auto), font size, compact mode
- **Settings Persistence**: All preferences saved to localStorage
- **Bundle Size**: 219.09 KB (63.65 KB gzipped)

**Total Features**: 25+ implemented features across UI, UX, and backend integration

## Roadmap / Upcoming Features

### Phase 5: Advanced Features (Planned)
- **Drag & Drop**: Intuitive proto file upload and request organization
- **Syntax Highlighting**: Code highlighting for JSON request/response bodies
- **Auto-complete**: IntelliSense for message types in request editor
- **Collections UI**: Visual folder management for saved requests
- **Export/Import**: Share workspaces and collections between team members
- **Request Diffing**: Compare requests side-by-side

### Backend Enhancements (Planned)
- **Proto workspace roots** to resolve imports recursively and auto-discover services/methods
- **TLS/SSL Support**: Certificate handling for secure connections
- **Advanced Auth**: OAuth, JWT, API keys
- **Connection Pooling**: Efficient connection management
- **Streaming Improvements**: Client and bidirectional streaming support

Track progress or propose additions through issues and discussions. See `PHASE4_COMPLETE.md` and `PHASE4_SUMMARY.md` for detailed completion reports.

## Repository Layout

```
grpcpeek/
├── frontend/          # React + Vite UI (TypeScript, Tailwind)
├── src-tauri/         # Tauri/Rust backend, commands, generated bindings
├── test-server/       # Sample Node.js gRPC server for local testing
└── README.md          # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- Rust toolchain (latest stable)
- Cargo prerequisites for Tauri (per platform):
  - Windows: Microsoft Visual C++ Build Tools, WebView2 runtime
  - macOS: Xcode Command Line Tools
  - Linux: `webkit2gtk`, `openssl`, `gtk3`, `libsoup2`, `librsvg2`

### Install dependencies

```powershell
cd grpcpeek/frontend
npm install

cd ..\src-tauri
cargo check
```

### Run the app in development

```powershell
cd c:\DATA\Projects\gRPCpeek\grpcpeek
cargo tauri dev
```

This command launches the Vite dev server on port `1420` and starts the Tauri shell with hot reload for both Rust and frontend changes.

### Build for production

```powershell
cargo tauri build
```

The build orchestrates a frontend production bundle and packages platform-specific binaries.

## Contributing

We welcome contributions of all sizes. To get started:

1. Fork the repository and create a topic branch from `recover` (or the current default branch).
2. Run `cargo fmt` and `npm run lint` before submitting PRs.
3. Add tests or sample usage when introducing new behavior.
4. Open a pull request describing the motivation, implementation details, and testing notes.

Check open issues or file a new one if you discover bugs or have feature ideas.

## License

gRPCpeek is licensed under the [MIT License](LICENSE).

## Community & Support

- **Issues**: Use GitHub Issues for bugs, feature requests, and questions.
- **Discussions**: Share usage tips or propose larger design changes in Discussions (once enabled).
- **Security**: Report vulnerabilities privately via email (security policy TBD) until a formal process is documented.

Thanks for checking out gRPCpeek—your feedback and contributions help shape the next-generation gRPC client experience!
