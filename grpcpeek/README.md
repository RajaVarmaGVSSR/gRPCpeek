# gRPCpeek App

This directory contains the Tauri desktop application for gRPCpeek.

For the public project overview, installation notes, screenshots, and contribution guide, see the repository-level [README](../README.md).

## Structure

```text
grpcpeek/
├── frontend/     # React, TypeScript, Vite, Tailwind CSS
└── src-tauri/    # Rust backend and Tauri configuration
```

## Development

Install frontend dependencies:

```sh
cd frontend
npm install
```

Run the desktop app:

```sh
cd ..
cargo tauri dev
```

Build the desktop app:

```sh
cargo tauri build
```

Run quick validation:

```sh
cd frontend
npm run build

cd ../src-tauri
cargo check
```
