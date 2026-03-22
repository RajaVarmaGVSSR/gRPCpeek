#!/bin/bash

# Script to generate TLS certificates for testing
# Creates: CA cert, server cert, and client cert for mTLS testing

set -e

CERTS_DIR="$(dirname "$0")"
cd "$CERTS_DIR"

echo "Generating TLS certificates for gRPC test server..."

# 1. Generate CA private key and certificate
echo "1. Generating CA certificate..."
openssl genrsa -out ca-key.pem 4096
openssl req -new -x509 -days 365 -key ca-key.pem -out ca-cert.pem -subj "/C=US/ST=California/L=San Francisco/O=gRPCpeek Test/CN=Test CA"

# 2. Generate server private key and certificate signing request
echo "2. Generating server certificate..."
openssl genrsa -out server-key.pem 4096
openssl req -new -key server-key.pem -out server-csr.pem -subj "/C=US/ST=California/L=San Francisco/O=gRPCpeek Test/CN=localhost"

# Create server certificate extension file
cat > server-ext.cnf << EOF
subjectAltName = DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1
extendedKeyUsage = serverAuth
EOF

# Sign server certificate with CA
openssl x509 -req -days 365 -in server-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -extfile server-ext.cnf

# 3. Generate client private key and certificate (for mTLS)
echo "3. Generating client certificate for mTLS..."
openssl genrsa -out client-key.pem 4096
openssl req -new -key client-key.pem -out client-csr.pem -subj "/C=US/ST=California/L=San Francisco/O=gRPCpeek Test/CN=Test Client"

# Create client certificate extension file
cat > client-ext.cnf << EOF
extendedKeyUsage = clientAuth
EOF

# Sign client certificate with CA
openssl x509 -req -days 365 -in client-csr.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem -extfile client-ext.cnf

# 4. Generate a self-signed certificate (for testing insecureSkipVerify)
echo "4. Generating self-signed certificate..."
openssl req -x509 -newkey rsa:4096 -keyout self-signed-key.pem -out self-signed-cert.pem -days 365 -nodes -subj "/C=US/ST=California/L=San Francisco/O=gRPCpeek Test/CN=localhost"

# Clean up temporary files
rm -f server-csr.pem client-csr.pem server-ext.cnf client-ext.cnf ca-cert.srl

# Set appropriate permissions
chmod 644 *.pem
chmod 600 *-key.pem

echo ""
echo "✅ Certificate generation complete!"
echo ""
echo "Generated certificates:"
echo "  - ca-cert.pem           : CA certificate (use as custom CA in gRPCpeek)"
echo "  - ca-key.pem            : CA private key"
echo "  - server-cert.pem       : Server certificate"
echo "  - server-key.pem        : Server private key"
echo "  - client-cert.pem       : Client certificate (for mTLS)"
echo "  - client-key.pem        : Client private key (for mTLS)"
echo "  - self-signed-cert.pem  : Self-signed certificate (for insecureSkipVerify testing)"
echo "  - self-signed-key.pem   : Self-signed private key"
echo ""
echo "Usage in gRPCpeek:"
echo "  - For TLS: Use ca-cert.pem as Server CA Certificate"
echo "  - For mTLS: Use ca-cert.pem as CA, client-cert.pem and client-key.pem"
echo "  - For self-signed: Use self-signed-cert.pem with insecureSkipVerify=true"
