# gRPCpeek

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern gRPC client to explore, debug, and test gRPC APIs.

## Features

*   **Modern UI**: Built with React, TypeScript, and Tailwind CSS for a clean and intuitive user experience.
*   **Cross-Platform**: Powered by Tauri, gRPCpeek runs on Windows, macOS, and Linux.
*   **Real-time API Exploration**: Discover and interact with gRPC services in real-time.
*   **Easy Debugging**: Inspect request and response payloads with ease.

## Installation Guide

To get started with gRPCpeek development, you'll need to set up both the Rust backend and the frontend environment.

### Prerequisites

1.  **Rust and Cargo**:
    - Install Rustup by following the official instructions at [rustup.rs](https://rustup.rs/). This will also install Cargo, the Rust package manager.
    ```sh
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    ```

2.  **Node.js and npm**:
    - Install Node.js (which includes npm) from the official website: [nodejs.org](https://nodejs.org/).

3.  **Tauri CLI**:
    - Install the Tauri CLI using Cargo:
    ```sh
    cargo install tauri-cli
    ```

4.  **Platform-specific dependencies**:
    - **Windows**: You'll need the Microsoft C++ Build Tools. The easiest way is to install them through the Visual Studio Installer. Also, ensure you have the [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) installed.
    - **macOS**: You'll need Xcode Command Line Tools.
    - **Linux (Debian/Ubuntu)**: You will need to install several development libraries.
      ```sh
      sudo apt-get update
      sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        libssl-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        libsoup2.4-dev
      ```

### First Run Instructions

1.  **Clone the repository**:
    ```sh
    git clone https://github.com/your-username/grpcpeek.git
    cd grpcpeek
    ```

2.  **Install frontend dependencies**:
    - Navigate to the `frontend` directory and install the Node.js packages.
    ```sh
    cd frontend
    npm install
    ```

3.  **Run the application in development mode**:
    - From the `grpcpeek` root directory, run the Tauri development command.
    ```sh
    cargo tauri dev
    ```

## Troubleshooting

### Linux Build Issues

#### 1. Icon Requirement

The Tauri build process requires a valid icon to complete. You must provide at least one icon in RGBA format.

- **Action**: Place a valid PNG icon (e.g., `32x32` pixels, RGBA format) at `src-tauri/icons/icon.png` and ensure it is referenced in `src-tauri/tauri.conf.json`.

#### 2. `webkitgtk` Version Mismatch

This project uses a version of Tauri that expects `webkitgtk-4.0`. Newer Linux distributions (e.g., Ubuntu 22.04 and later) provide `webkitgtk-4.1`. This can cause build failures related to `pkg-config`.

- **Workaround**: If you encounter errors related to `javascriptcoregtk-4.0` or `webkit2gtk-4.0`, you can use the following command to trick the build system into using the `4.1` libraries. Run this from the `grpcpeek/src-tauri` directory:
  ```sh
  mkdir -p /tmp/pkg-config-hack && \
  cp /usr/lib/x86_64-linux-gnu/pkgconfig/javascriptcoregtk-4.1.pc /tmp/pkg-config-hack/javascriptcoregtk-4.0.pc && \
  cp /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc /tmp/pkg-config-hack/webkit2gtk-4.0.pc && \
  PKG_CONFIG_PATH=/tmp/pkg-config-hack cargo check
  ```

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

Please make sure to update tests as appropriate.
