# Certificate Generation README

This directory contains scripts to generate TLS certificates for testing the gRPC server with various security configurations.

> **⚠️ Important**: The generated certificates (`.pem` files) are **not committed to git** for security reasons. Each developer must generate their own certificates locally using the provided scripts.

## Prerequisites

You need OpenSSL installed on your system:

- **Windows**: See [WINDOWS-OPENSSL-INSTALL.md](./WINDOWS-OPENSSL-INSTALL.md) for detailed installation guide
  - Quick: Download from https://slproweb.com/products/Win32OpenSSL.html
  - Or use Chocolatey: `choco install openssl`
- **macOS**: `brew install openssl`
- **Linux**: Usually pre-installed, or `sudo apt-get install openssl` / `sudo yum install openssl`

### Windows Users - OpenSSL Installation

If you get **"'openssl' is not recognized"** error on Windows:
👉 **See [WINDOWS-OPENSSL-INSTALL.md](./WINDOWS-OPENSSL-INSTALL.md)** for step-by-step installation instructions.

## Generating Certificates

### On Linux/macOS:
```bash
chmod +x generate-certs.sh
./generate-certs.sh
```

### On Windows:
```batch
generate-certs.bat
```

## Generated Files

After running the script, you'll have:

| File | Description | Use Case |
|------|-------------|----------|
| `ca-cert.pem` | Certificate Authority certificate | Custom CA for TLS verification |
| `ca-key.pem` | CA private key | Signing certificates |
| `server-cert.pem` | Server certificate | Server-side TLS |
| `server-key.pem` | Server private key | Server-side TLS |
| `client-cert.pem` | Client certificate | Client authentication (mTLS) |
| `client-key.pem` | Client private key | Client authentication (mTLS) |
| `self-signed-cert.pem` | Self-signed certificate | Testing insecureSkipVerify |
| `self-signed-key.pem` | Self-signed private key | Testing insecureSkipVerify |

## Security Warning

⚠️ **These certificates are for testing purposes only!** 

- Never use these in production
- Keys are not password-protected
- Certificate validity is only 365 days
- Using common test subject names

## Re-generating Certificates

You can safely re-run the script to generate new certificates. The script will overwrite existing files.

To start fresh:
```bash
rm *.pem *.srl
./generate-certs.sh  # or generate-certs.bat on Windows
```
