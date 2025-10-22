# gRPCpeek Test Server v2.0

A comprehensive test gRPC server designed to test all features of gRPCpeek client. This server supports multiple proto files with imports, all gRPC streaming patterns, and various security modes (insecure, TLS, mTLS, self-signed).

---

## 🎯 Documentation Quick Links

- **🚀 [TESTING-QUICK-START.md](./TESTING-QUICK-START.md)** - 5-minute setup guide (START HERE!)
- **📝 [TEST-SCENARIOS.md](./TEST-SCENARIOS.md)** - Complete test scenarios with step-by-step instructions
- **📖 [README-v2.md](./README-v2.md)** - Comprehensive 25-page guide (all details)
- **⚡ [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** - Command cheat sheet
- **🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and diagrams
- **📋 [ENHANCEMENT-SUMMARY.md](./ENHANCEMENT-SUMMARY.md)** - Implementation summary

**New to testing gRPCpeek?** → Start with [TESTING-QUICK-START.md](./TESTING-QUICK-START.md)

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Project Structure](#project-structure)
- [Security Modes](#security-modes)
- [Services Overview](#services-overview)
- [Testing Scenarios](#testing-scenarios)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate TLS Certificates (for secure modes)

**Linux/macOS:**
```bash
cd certs
chmod +x generate-certs.sh
./generate-certs.sh
cd ..
```

**Windows:**
```batch
cd certs
generate-certs.bat
cd ..
```

### 3. Start the Server

**Insecure mode (no TLS):**
```bash
npm start
# or
npm run start:insecure
```

**TLS mode:**
```bash
npm run start:tls
```

**mTLS mode (mutual TLS):**
```bash
npm run start:mtls
```

**Self-signed certificate mode:**
```bash
npm run start:self-signed
```

The server will run on `localhost:50051` by default.

## ✨ Features

### 🔹 Multiple Proto Files with Imports
- **Organized structure**: Common types, models, and services in separate files
- **Proto imports**: Tests cross-file references and dependencies
- **Real-world patterns**: Mimics production proto organization

### 🔹 All gRPC Streaming Patterns
- ✅ **Unary**: Simple request-response
- ✅ **Server Streaming**: Single request, multiple responses
- ✅ **Client Streaming**: Multiple requests, single response
- ✅ **Bidirectional Streaming**: Multiple requests and responses

### 🔹 Security Modes
- ✅ **Insecure**: No TLS (default)
- ✅ **TLS**: Server-side TLS with CA verification
- ✅ **mTLS**: Mutual TLS (client certificate required)
- ✅ **Self-signed**: For testing insecureSkipVerify

### 🔹 Rich Service Implementations
- 6 different services with realistic data
- CRUD operations, authentication, e-commerce, chat
- Various protobuf types (enums, oneofs, maps, repeated fields)
- Error handling and status codes

## 📁 Project Structure

```
test-server/
├── proto/                          # Proto definitions
│   ├── common/                     # Shared types
│   │   └── types.proto            # Status, Pagination, Address, etc.
│   ├── models/                     # Data models
│   │   ├── user.proto             # User model
│   │   ├── product.proto          # Product model
│   │   └── order.proto            # Order model
│   └── services/                   # Service definitions
│       ├── hello.proto            # Hello service (unary, server-streaming)
│       ├── user.proto             # User CRUD service
│       ├── chat.proto             # Chat service (bidirectional, client-streaming)
│       ├── shop.proto             # E-commerce service
│       ├── auth.proto             # Authentication service
│       └── echo.proto             # Echo service (various types)
│
├── certs/                          # TLS certificates
│   ├── generate-certs.sh          # Certificate generation (Linux/macOS)
│   ├── generate-certs.bat         # Certificate generation (Windows)
│   └── README.md                  # Certificate usage guide
│
├── server-v2.js                    # Enhanced server implementation
├── server.js                       # Legacy server (backwards compatibility)
├── test.proto                      # Legacy single proto file
├── package.json
└── README.md                       # This file
```

## 🔐 Security Modes

### Insecure Mode (Default)

No encryption, suitable for local development.

```bash
npm start
# Server runs at: localhost:50051 (no TLS)
```

**gRPCpeek Configuration:**
- Endpoint: `localhost:50051`
- TLS: Disabled

---

### TLS Mode

Server uses TLS certificate signed by a CA. Client verifies server identity.

```bash
npm run start:tls
```

**gRPCpeek Configuration:**
- Endpoint: `localhost:50051`
- TLS: Enabled
- Server CA Certificate: `<test-server>/certs/ca-cert.pem`
- Client Certificate: None
- Client Key: None

---

### mTLS Mode (Mutual TLS)

Both server and client authenticate each other using certificates.

```bash
npm run start:mtls
```

**gRPCpeek Configuration:**
- Endpoint: `localhost:50051`
- TLS: Enabled
- Server CA Certificate: `<test-server>/certs/ca-cert.pem`
- Client Certificate: `<test-server>/certs/client-cert.pem`
- Client Key: `<test-server>/certs/client-key.pem`

---

### Self-Signed Certificate Mode

Server uses a self-signed certificate (not trusted by default).

```bash
npm run start:self-signed
```

**gRPCpeek Configuration:**
- Endpoint: `localhost:50051`
- TLS: Enabled
- Server CA Certificate: None
- Insecure Skip Verify: ✅ **Enabled**

---

## 📡 Services Overview

### 1. HelloService (`services.HelloService`)

Simple greeting service for testing basic operations.

**Methods:**
- `SayHello` (Unary) - Returns a greeting in specified language
- `SayHelloServerStream` (Server Streaming) - Streams 10 greetings
- `SayMultipleHellos` (Unary) - Returns greetings in multiple languages

**Example Request (SayHello):**
```json
{
  "name": "World",
  "language": "en"
}
```

**Supported Languages:** `en`, `es`, `fr`, `de`, `ja`, `zh`

---

### 2. UserService (`services.UserService`)

CRUD operations for user management.

**Methods:**
- `CreateUser` (Unary) - Create a new user
- `GetUser` (Unary) - Get user by ID
- `ListUsers` (Server Streaming) - List users with pagination
- `UpdateUser` (Unary) - Update user details
- `DeleteUser` (Unary) - Delete a user
- `BatchGetUsers` (Unary) - Get multiple users at once
- `SearchUsers` (Server Streaming) - Search users by name/email

**Example Request (CreateUser):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "country": "USA",
    "postal_code": "94102"
  },
  "roles": ["user", "admin"]
}
```

---

### 3. ChatService (`services.ChatService`)

Real-time chat with streaming.

**Methods:**
- `Chat` (Bidirectional Streaming) - Real-time chat conversation
- `UploadMessages` (Client Streaming) - Upload multiple messages, get summary
- `SubscribeToRoom` (Server Streaming) - Subscribe to room messages

**Example Message (Chat):**
```json
{
  "user_id": "user-123",
  "user_name": "Alice",
  "room_id": "general",
  "message": "Hello everyone!",
  "type": 1
}
```

---

### 4. ShopService (`services.ShopService`)

E-commerce operations.

**Methods:**
- `CreateProduct` (Unary) - Create a product
- `GetProduct` (Unary) - Get product by ID
- `ListProducts` (Server Streaming) - List products with filters
- `CreateOrder` (Unary) - Create an order
- `GetOrder` (Unary) - Get order by ID
- `TrackOrder` (Server Streaming) - Track order status changes
- `BatchCreateProducts` (Client Streaming) - Batch create products

**Example Request (CreateProduct):**
```json
{
  "name": "Laptop",
  "description": "High-performance laptop",
  "price": 999.99,
  "currency": "USD",
  "stock_quantity": 50,
  "category": "Electronics",
  "tags": ["computer", "laptop", "portable"]
}
```

---

### 5. AuthService (`services.AuthService`)

Authentication and token management.

**Methods:**
- `Login` (Unary) - User login
- `Logout` (Unary) - User logout
- `RefreshToken` (Unary) - Refresh access token
- `ValidateToken` (Unary) - Validate token

**Example Request (Login):**
```json
{
  "username": "alice",
  "password": "secret123",
  "device_id": "web-browser"
}
```

**Testing Auth:**
1. Call `Login` to get an `access_token`
2. Use the token in metadata: `authorization: Bearer <token>`
3. Call other protected endpoints

---

### 6. EchoService (`services.EchoService`)

Test various protobuf types (oneofs, maps, repeated fields).

**Methods:**
- `Echo` (Unary) - Echo back any payload
- `EchoStream` (Bidirectional Streaming) - Echo stream
- `EchoDelayed` (Server Streaming) - Echo with delay

**Example Request (Echo with text):**
```json
{
  "text": "Hello",
  "items": ["item1", "item2"],
  "metadata": {
    "key1": "value1"
  },
  "repeat_count": 3
}
```

**Example Request (Echo with complex data):**
```json
{
  "complex": {
    "id": "test-123",
    "nested": [
      {
        "key": "k1",
        "value": 42,
        "tags": ["tag1", "tag2"]
      }
    ]
  }
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Test Proto Parsing with Multiple Files

**Goal:** Verify gRPCpeek can parse proto files with imports.

**Steps:**
1. In gRPCpeek, import the entire `proto/` directory
2. Verify all services are listed
3. Check that types from `common/types.proto` and `models/*.proto` are properly resolved

**Expected:** All 6 services should appear with correct method signatures.

---

### Scenario 2: Test All Streaming Patterns

**Goal:** Test unary, server streaming, client streaming, and bidirectional streaming.

**Tests:**
- **Unary**: `HelloService.SayHello`
- **Server Streaming**: `HelloService.SayHelloServerStream`
- **Client Streaming**: `ChatService.UploadMessages`
- **Bidirectional**: `ChatService.Chat`

---

### Scenario 3: Test TLS Configuration

**Goal:** Test different TLS modes.

**Steps:**
1. Start server in TLS mode: `npm run start:tls`
2. In gRPCpeek, create environment with TLS enabled
3. Set Server CA Certificate to `certs/ca-cert.pem`
4. Call `HelloService.SayHello`

**Expected:** Successful connection with TLS encryption.

---

### Scenario 4: Test mTLS (Mutual TLS)

**Goal:** Test client certificate authentication.

**Steps:**
1. Start server in mTLS mode: `npm run start:mtls`
2. In gRPCpeek, configure:
   - TLS: Enabled
   - Server CA: `certs/ca-cert.pem`
   - Client Certificate: `certs/client-cert.pem`
   - Client Key: `certs/client-key.pem`
3. Call any service

**Expected:** Connection succeeds with mutual authentication.

---

### Scenario 5: Test Self-Signed Certificate

**Goal:** Test `insecureSkipVerify` for self-signed certificates.

**Steps:**
1. Start server: `npm run start:self-signed`
2. In gRPCpeek, configure:
   - TLS: Enabled
   - Insecure Skip Verify: ✅ Enabled
3. Call any service

**Expected:** Connection succeeds despite untrusted certificate.

---

### Scenario 6: Test Authentication

**Goal:** Test Bearer token authentication.

**Steps:**
1. Call `AuthService.Login` with:
   ```json
   {
     "username": "testuser",
     "password": "testpass"
   }
   ```
2. Copy the `access_token` from response
3. Create environment with metadata:
   ```
   authorization: Bearer <access_token>
   ```
4. Call `AuthService.ValidateToken` with the token

**Expected:** Token is validated successfully.

---

### Scenario 7: Test Environment Variables

**Goal:** Test variable resolution in requests.

**Steps:**
1. Create environment variables:
   - `username`: `alice`
   - `language`: `en`
2. In request body, use:
   ```json
   {
     "name": "{{env.username}}",
     "language": "{{env.language}}"
   }
   ```
3. Call `HelloService.SayHello`

**Expected:** Variables are resolved, greeting uses "alice" and "en".

---

### Scenario 8: Test CRUD Operations

**Goal:** Test full CRUD cycle for users.

**Steps:**
1. **Create**: `UserService.CreateUser` → Note the `id`
2. **Read**: `UserService.GetUser` with the `id`
3. **Update**: `UserService.UpdateUser` with modified data
4. **Delete**: `UserService.DeleteUser` with the `id`
5. **Verify**: `UserService.GetUser` should return NOT_FOUND

---

### Scenario 9: Test Server Streaming

**Goal:** Test long-running server streams.

**Steps:**
1. Call `HelloService.SayHelloServerStream`
2. Observe 10 messages streamed over ~5 seconds

**Expected:** UI shows streaming progress with each message.

---

### Scenario 10: Test Error Handling

**Goal:** Test gRPC error codes.

**Steps:**
1. Call `UserService.GetUser` with invalid ID: `"invalid-id"`
2. Observe error response with code `NOT_FOUND`

---

## 🔧 Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Server port | `50051` | `PORT=9090 npm start` |
| `TLS_MODE` | Security mode | `insecure` | `TLS_MODE=tls npm start` |

**TLS_MODE Options:**
- `insecure` - No TLS
- `tls` - Server-side TLS
- `mtls` - Mutual TLS (client cert required)
- `self-signed` - Self-signed certificate

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@grpc/grpc-js'"

**Solution:**
```bash
npm install
```

### Issue: "ENOENT: no such file or directory, open 'certs/ca-cert.pem'"

**Solution:** Generate certificates first:
```bash
cd certs
./generate-certs.sh  # or generate-certs.bat on Windows
cd ..
```

### Issue: "Error: 14 UNAVAILABLE: No connection established"

**Possible causes:**
1. Server not running → Start server first
2. Wrong port → Check server output for actual port
3. TLS mismatch → Ensure client TLS settings match server mode

### Issue: "Error: 16 UNAUTHENTICATED: Client certificate required"

**Solution:** Server is in mTLS mode. Configure client certificate in gRPCpeek.

### Issue: Proto parsing fails in gRPCpeek

**Solution:** Make sure to:
1. Import the `proto/` directory (not individual files)
2. Add all necessary import paths in gRPCpeek

---

## 📚 Additional Resources

### Using with grpcurl

```bash
# List services
grpcurl -plaintext localhost:50051 list

# Call a method
grpcurl -plaintext -d '{"name": "World"}' localhost:50051 services.HelloService/SayHello

# With TLS
grpcurl -cacert certs/ca-cert.pem localhost:50051 list
```

### Proto Documentation

See `proto/` directory for detailed proto definitions:
- `common/types.proto` - Common types (Timestamp, Status, Address, etc.)
- `models/*.proto` - Data models (User, Product, Order)
- `services/*.proto` - Service definitions

---

## 🎯 Summary

This test server provides a comprehensive testing environment for gRPCpeek:

✅ **6 services** with realistic implementations  
✅ **Multiple proto files** with imports (tests proto parser)  
✅ **All 4 streaming patterns** (unary, server, client, bidirectional)  
✅ **4 security modes** (insecure, TLS, mTLS, self-signed)  
✅ **Rich data types** (enums, oneofs, maps, repeated fields, nested messages)  
✅ **Authentication** (Bearer tokens, token validation)  
✅ **Error handling** (gRPC status codes)  
✅ **CRUD operations** (Create, Read, Update, Delete)  

Happy testing! 🚀
