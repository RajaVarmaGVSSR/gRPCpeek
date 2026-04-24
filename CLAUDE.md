# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

gRPCpeek is a Tauri 2 desktop application — a native gRPC GUI client. It has two main subsystems:

- **Rust backend** (`grpcpeek/src-tauri/`) — Tauri shell + all gRPC protocol logic (TLS, streaming, proto parsing)
- **React frontend** (`grpcpeek/frontend/`) — TypeScript, React 18, Vite, Tailwind CSS

IPC between frontend and backend uses Tauri's `invoke()` / `emit()` API, not HTTP.

A standalone Node.js test server lives in `test-server/` for local manual testing only.

## Commands

### Development

```sh
cd grpcpeek/frontend && npm install
cd grpcpeek && cargo tauri dev    # opens native window; Vite runs on port 1420
```

### Build

```sh
cd grpcpeek/frontend && npm run build    # tsc + Vite -> frontend/dist/
cd grpcpeek/src-tauri && cargo tauri build
```

### Validate (pre-PR)

```sh
cd grpcpeek/frontend && npm run build    # catches TypeScript errors
cd grpcpeek/src-tauri && cargo check
```

### Rust tests

```sh
cd grpcpeek/src-tauri && cargo test
```

The only meaningful test file is `src/proto_parser.rs` (`#[cfg(test)]` block at the bottom). No JS/TS test runner is configured.

### Lint/format (manual)

```sh
cd grpcpeek/frontend && npx eslint src --ext .ts,.tsx
```

Prettier config: 2-space indent, single quotes, 100-char print width, trailing commas (es5). There is no `npm run lint` or `npm run format` script.

### Test server

```sh
cd test-server && npm install
npm start              # insecure, localhost:50051
npm run start:tls      # TLS mode
npm run start:mtls     # mutual TLS
```

## Architecture

### Tauri IPC surface (all commands in `grpcpeek/src-tauri/src/main.rs`)

| Command | Purpose |
|---|---|
| `parse_proto_files` | Parse multiple proto files using import paths |
| `call_grpc_method` | Unary + server-streaming gRPC calls |
| `start_client_stream` | Open client/bidirectional stream |
| `send_stream_message` | Send message into open stream |
| `finish_streaming` | Close stream and collect response |
| `generate_sample_request` | Generate sample JSON for a message type |
| `open_response_in_temp_file` | Write response to OS temp and open it |
| `save_response_to_file` | Save response JSON to user-chosen path |

### Proto parsing (`grpcpeek/src-tauri/src/proto_parser.rs`)

Two-phase:
1. Regex extraction of service/method names (always works)
2. `protox::compile()` (pure-Rust, compiled into the binary) to produce a `FileDescriptorSet` → `DescriptorPool` for accurate sample request generation

No external tools required. Only files containing `service` blocks are passed to protox; transitive imports are resolved automatically.

### Streaming

Server-streaming and bidirectional streaming emit Tauri events (`grpc-stream-message`) rather than returning command results. The frontend listens via `@tauri-apps/api/event`'s `listen()`. Client streams are kept alive in a `Mutex<HashMap<String, ActiveClientStream>>` between `invoke` calls.

### State persistence

All user data (workspaces, tabs, environments, history) is stored in browser `localStorage` — keys `grpcpeek_workspaces_v2` and `grpcpeek_active_workspace_v2`. No server or filesystem storage. Schema migrations are handled by `migrateWorkspace()` in `grpcpeek/frontend/src/lib/workspace.ts`.

### Key frontend files

| File | Purpose |
|---|---|
| `frontend/src/types/workspace.ts` | All TypeScript types |
| `frontend/src/lib/workspace.ts` | Workspace CRUD via localStorage |
| `frontend/src/lib/variableResolver.ts` | `{{env.x}}` / `{{global.x}}` substitution |
| `frontend/src/hooks/useRequestManager.ts` | Request/tab state |
| `frontend/src/hooks/useWorkspaceManager.ts` | Workspace state |
| `frontend/src/contexts/ModalContext.tsx` | Centralized modal system |
| `frontend/src/contexts/ToastContext.tsx` | Toast notifications |

## Non-Obvious Constraints

- **No external runtime tools required.** Proto compilation uses the `protox` crate (pure Rust, bundled in the binary). Users do not need `protoc` installed.
- **Vite port is hardcoded to 1420** (`strictPort: true`). Changing it requires updating both `vite.config.ts` and `tauri.conf.json` (`devUrl`).
- **Version is dual-tracked** in `tauri.conf.json` and `frontend/package.json`. CI auto-bumps both on release.
- **TLS** is handled via `hyper-rustls` + `rustls`. The frontend passes a `TlsConfig` struct with every gRPC call; HTTP/2-only is enforced.
- **`withGlobalTauri: true`** — Tauri APIs are available both via module imports and `window.__TAURI__`.
- **prost ecosystem is pinned to `0.14`/`0.16`** to match `protox 0.9.1`. Keep all three in sync (`prost`, `prost-types`, `prost-reflect`) when upgrading.
- CI builds on tag push or `release/**` branches; macOS produces a universal fat binary (`--target universal-apple-darwin`); releases are created as drafts.
