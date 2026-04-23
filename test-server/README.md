# gRPCpeek Test Server

This directory contains a local gRPC server for testing gRPCpeek. It is intentionally broad enough to exercise proto imports, every gRPC streaming mode, request metadata, auth-like flows, TLS, mTLS, and self-signed certificate handling.

## Quick start

Install dependencies:

```sh
npm install
```

Start the default insecure server:

```sh
npm start
```

The server listens on `localhost:50051`.

In gRPCpeek:

1. Open workspace settings.
2. Add `test-server/proto` as an import directory.
3. Parse proto files.
4. Use host `localhost` and port `50051`.
5. Open a service method and send a request.

## Security modes

Generate local test certificates first when using TLS modes:

```sh
npm run certs
```

On Windows:

```bat
npm run certs:win
```

Run one of the server modes:

```sh
npm run start:insecure
npm run start:tls
npm run start:mtls
npm run start:self-signed
```

### gRPCpeek TLS settings

For `start:tls`:

- Enable TLS.
- Set server CA certificate to `test-server/certs/ca-cert.pem`.
- Leave client certificate and client key empty.

For `start:mtls`:

- Enable TLS.
- Set server CA certificate to `test-server/certs/ca-cert.pem`.
- Set client certificate to `test-server/certs/client-cert.pem`.
- Set client key to `test-server/certs/client-key.pem`.

For `start:self-signed`:

- Enable TLS.
- Enable insecure skip verify.
- Do not use this mode outside local testing.

See [certs/README.md](certs/README.md) for certificate details.

## Services

The proto files live under [proto/parent](proto/parent).

| Service | What it tests |
| --- | --- |
| `HelloService` | Simple unary calls and server streaming. |
| `UserService` | CRUD-style requests, repeated fields, search, and server streaming. |
| `ChatService` | Bidirectional streaming, client streaming, and room subscription streaming. |
| `AuthService` | Login, logout, token refresh, and token validation request shapes. |
| `EchoService` | Echo calls, complex protobuf shapes, and streaming echo flows. |
| `ShopService` | E-commerce-style models, nested imports, server streaming, and client streaming. |

## Proto layout

```text
proto/
└── parent/
    ├── common/          # Shared types
    ├── google/type/     # Local Money proto used by product/order models
    ├── models/          # User, product, and order models
    └── services/        # gRPC service definitions
```

## Useful sample calls

After parsing `test-server/proto` in gRPCpeek, try:

- `services.HelloService.SayHello`
- `services.HelloService.SayHelloServerStream`
- `services.ChatService.UploadMessages`
- `services.ChatService.Chat`
- `services.EchoService.Echo`
- `services.ShopService.TrackOrder`
- `services.UserService.ListUsers`

gRPCpeek should generate starter JSON for each method. You can reset a request body with "Reset to Sample" in the request editor.

## Troubleshooting

### Port already in use

The server defaults to `50051`. Stop the existing process or run the server in a separate terminal after freeing the port.

### Proto files are not discovered

Add the directory `test-server/proto` as the import path in gRPCpeek, not an individual nested service file. The parser needs the root import directory so cross-file imports can resolve.

### TLS connection fails

Regenerate certificates and restart the server:

```sh
npm run certs
npm run start:tls
```

Then confirm the matching certificate paths are selected in gRPCpeek.

### mTLS connection fails

Make sure all three files are configured:

- `ca-cert.pem`
- `client-cert.pem`
- `client-key.pem`

### Self-signed mode fails

For `npm run start:self-signed`, enable insecure skip verify in gRPCpeek. This is only for local development.
