# gRPCpeek Development Guide for AI Agents

## Project Architecture

gRPCpeek is a cross-platform gRPC client built with **Tauri** (Rust backend) + **React/TypeScript frontend**. The project follows a dual-process architecture where the Rust backend handles system integration while the web frontend provides the UI.

### Key Structure
- `grpcpeek/src-tauri/` - Rust/Tauri backend (system APIs, native features)
- `grpcpeek/frontend/` - React/TypeScript frontend (UI, client logic) 
- Build system coordinates both: frontend builds first → Tauri bundles into native app

## Development Workflow

### Starting Development
```bash
# From grpcpeek/ root - this is the PRIMARY development command
cargo tauri dev
```
This command:
1. Runs `npm run dev --prefix ../frontend` (Vite dev server on port 1420)
2. Starts Tauri with hot reload for both frontend and Rust changes
3. **Never run frontend and Tauri separately** - use this unified command

### Production Build
```bash
cargo tauri build  # Builds frontend then creates platform-specific bundles
```

### Frontend-only Development (when needed)
```bash
cd frontend && npm run dev  # Port 1420 (Tauri expects this exact port)
```

## Critical Configuration Patterns

### Tauri Integration Points
- **Port requirement**: Frontend MUST run on port 1420 (`vite.config.ts` strictPort: true)
- **Build coordination**: `tauri.conf.json` orchestrates frontend build before Tauri packaging
- **Environment variables**: Use `TAURI_*` prefix for Tauri-specific vars, `VITE_*` for frontend

### Vite Configuration (frontend/vite.config.ts)
```typescript
// These settings are REQUIRED for Tauri integration:
server: { port: 1420, strictPort: true }  // Tauri expects this port
clearScreen: false  // Don't hide Rust compilation errors
envPrefix: ['VITE_', 'TAURI_']  // Expose Tauri env vars to frontend
```

## Platform-Specific Concerns

### Linux Development
- **WebKit version mismatch**: Ubuntu 22.04+ has webkitgtk-4.1, but Tauri expects 4.0
- **Workaround for build issues**:
  ```bash
  # From src-tauri/ directory if you get pkg-config errors:
  mkdir -p /tmp/pkg-config-hack
  cp /usr/lib/x86_64-linux-gnu/pkgconfig/javascriptcoregtk-4.1.pc /tmp/pkg-config-hack/javascriptcoregtk-4.0.pc
  cp /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc /tmp/pkg-config-hack/webkit2gtk-4.0.pc
  PKG_CONFIG_PATH=/tmp/pkg-config-hack cargo check
  ```

### Windows-Specific
- **Console window suppression**: `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` in main.rs
- **WebView2 dependency**: Required runtime for Windows builds

## Code Organization Patterns

### Frontend (React/TypeScript)
- **Styling**: Tailwind CSS with minimal custom CSS (`index.css` only imports Tailwind)
- **Entry point**: `main.tsx` → `App.tsx` (currently basic, expand here for routing)
- **Build target**: Modern browsers (Chrome 105+/Safari 13+) due to Tauri's embedded webview

### Backend (Rust/Tauri)
- **Main entry**: `src-tauri/src/main.rs` (currently minimal, expand here for gRPC logic)
- **Tauri commands**: Add `#[tauri::command]` functions here for frontend ↔ backend communication
- **Dependencies**: Core app logic should go in `src-tauri/src/`, keep `main.rs` as orchestrator

## Essential Dependencies

### Frontend Stack
- React 18 + TypeScript + Vite (build tool)
- Tailwind CSS (utility-first styling)
- **No state management yet** - consider adding when gRPC features expand

### Backend Stack  
- Tauri 1.6+ (native app framework)
- serde + serde_json (serialization for frontend communication)
- **Missing gRPC deps** - likely need `tonic` or similar when implementing core features

## Common Development Tasks

### Adding Tauri Commands (Backend → Frontend API)
```rust
// In src-tauri/src/main.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

// Register in builder
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
```

### Frontend Tauri API Usage
```typescript
import { invoke } from '@tauri-apps/api/tauri'
const result = await invoke('greet', { name: 'World' })
```

### Troubleshooting Build Issues
1. **Frontend build fails**: Check Node.js version compatibility
2. **Tauri build fails**: Verify platform dependencies (WebView2/WebKit)
3. **Port conflicts**: Ensure port 1420 is available
4. **Icon missing**: Tauri requires valid icon at `src-tauri/icons/icon.png`

---

*This project is in early development - core gRPC functionality is not yet implemented. Focus on establishing the Tauri ↔ React communication patterns before adding gRPC features.*