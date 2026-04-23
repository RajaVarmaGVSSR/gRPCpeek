# Test Certificates

This directory contains scripts for generating local TLS certificates used by the gRPCpeek test server.

The generated `.pem` files are ignored by git. They are for local development only and should never be used in production.

## Prerequisites

Install OpenSSL:

- macOS: `brew install openssl`
- Debian/Ubuntu: `sudo apt-get install openssl`
- Fedora: `sudo dnf install openssl`
- Windows: install OpenSSL with your preferred package manager, for example `choco install openssl`, or use a standard Windows OpenSSL installer.

## Generate certificates

Linux or macOS:

```sh
chmod +x generate-certs.sh
./generate-certs.sh
```

Windows Command Prompt:

```bat
generate-certs.bat
```

PowerShell:

```powershell
.\generate-certs.ps1
```

## Generated files

| File | Purpose |
| --- | --- |
| `ca-cert.pem` | Local CA certificate for server verification. |
| `ca-key.pem` | Local CA private key. |
| `server-cert.pem` | Server certificate for TLS mode. |
| `server-key.pem` | Server private key for TLS mode. |
| `client-cert.pem` | Client certificate for mTLS mode. |
| `client-key.pem` | Client private key for mTLS mode. |
| `self-signed-cert.pem` | Self-signed server certificate for insecure skip verify testing. |
| `self-signed-key.pem` | Self-signed server private key. |

## Regenerate certificates

It is safe to regenerate these files:

```sh
rm -f *.pem *.srl
./generate-certs.sh
```

On Windows, delete the generated `.pem` and `.srl` files, then run `generate-certs.bat` or `generate-certs.ps1` again.

## Security note

These certificates are intentionally simple local test fixtures:

- Private keys are not password-protected.
- Subject names are generic.
- Validity is limited.
- They are not suitable for production systems.
