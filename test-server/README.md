# gRPC Test Server

A test gRPC server for testing the gRPCpeek client application.

## Services

### HelloService
- `SayHello` - Simple unary call that returns a greeting
- `SayHelloStream` - Server streaming call that sends multiple greetings

### UserService
- `CreateUser` - Create a new user
- `GetUser` - Get a user by ID
- `ListUsers` - Stream all users with pagination
- `UpdateUser` - Update an existing user
- `DeleteUser` - Delete a user

### ChatService
- `Chat` - Bidirectional streaming for chat messages

### EchoService
- `Echo` - Echo back any message (demonstrates different payload types)
- `EchoStream` - Stream echo responses

## Running the Server

```bash
# Install dependencies
npm install

# Generate protobuf files (optional, already included)
npm run generate

# Start the server
npm start
```

The server will run on `localhost:50051` with insecure credentials.

## Testing

You can use tools like `grpcurl` or `grpcui` to test the server:

```bash
# Install grpcurl
go install github.com/fullstorydev/grpcurl@latest

# List services
grpcurl -plaintext localhost:50051 list

# Call a method
grpcurl -plaintext -d '{"name": "World"}' localhost:50051 test.HelloService/SayHello
```

## Proto File

The protobuf definition is in `test.proto`. It includes various message types and services to test different gRPC patterns.