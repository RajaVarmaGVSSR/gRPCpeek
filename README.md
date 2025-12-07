# gRPCpeek

gRPCpeek is an open-source desktop client for exploring and testing gRPC services. It combines a Tauri (Rust) backend with a modern React + TypeScript frontend, giving developers a lightweight native experience across macOS, Windows, and Linux.

## Project Vision

Our goal is to deliver a Postman-class workflow for gRPC without the bloat:
- Import proto definitions and build organized collections of services.
- Configure environments (hosts, ports, TLS/auth settings) and reuse them across requests.
- Craft requests with structured metadata, send them instantly, and inspect responses in detail.

## 📦 Installation

### Download Pre-Built Releases (Recommended)

Get the latest stable version from our [**Releases page**](https://github.com/RajaVarmaGVSSR/gRPCpeek/releases).

**Portable Executables** (no installation required) ⭐:
- **Windows**: Download `gRPCpeek-vX.X.X-windows-portable.zip`, extract, and run `grpcpeek.exe`
- **macOS**: Download `gRPCpeek-vX.X.X-macos-portable.zip`, extract, run `xattr -cr gRPCpeek.app`, then open the app
- **Linux**: Download `grpcpeek_X.X.X_amd64.AppImage`, make it executable (`chmod +x`), and run

**Traditional Installers**:
- Windows: `.msi` or `-setup.exe`
- macOS: `.dmg` 
- Linux: `.deb`

> ⚠️ **Note**: Our builds are currently unsigned. Windows may show SmartScreen warnings, and macOS will require Gatekeeper bypass. This is normal for free, open-source builds.

### Build from Source

Want to build locally or contribute to development? See the [Development Setup](#getting-started) section below.

## Repository Layout

```
grpcpeek/
├── frontend/          # React + Vite UI (TypeScript, Tailwind)
├── src-tauri/         # Tauri/Rust backend, commands, generated bindings
├── test-server/       # Sample Node.js gRPC server for local testing
└── README.md          # This file
```

## Getting Started

> 💡 **Just want to use gRPCpeek?** Download a pre-built release from the [Installation](#-installation) section above.

This section is for developers who want to build from source or contribute to the project.

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

1. Fork the repository and create a topic branch from `main` (or the current default branch).
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
