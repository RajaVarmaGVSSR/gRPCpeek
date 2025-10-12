const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { v4: uuidv4 } = require('uuid');

// Load the protobuf definition
const PROTO_PATH = './test.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const testProto = grpc.loadPackageDefinition(packageDefinition).test;

// In-memory storage for demo purposes
const users = new Map();
let chatRooms = new Map();

// Hello Service Implementation
const helloService = {
  SayHello: (call, callback) => {
    const { name, language = 'en' } = call.request;

    const greetings = {
      en: `Hello ${name}!`,
      es: `¡Hola ${name}!`,
      fr: `Bonjour ${name}!`,
      de: `Hallo ${name}!`,
    };

    const message = greetings[language] || greetings.en;

    callback(null, {
      message,
      timestamp: new Date().toISOString(),
      server_version: '1.0.0',
    });
  },

  SayHelloStream: (call) => {
    const { name, language = 'en' } = call.request;

    let count = 0;
    const interval = setInterval(() => {
      if (count >= 5) {
        clearInterval(interval);
        call.end();
        return;
      }

      call.write({
        message: `Hello ${name}! (message ${count + 1})`,
        timestamp: new Date().toISOString(),
        server_version: '1.0.0',
      });
      count++;
    }, 1000);
  },
};

// User Service Implementation
const userService = {
  CreateUser: (call, callback) => {
    const { name, email, age } = call.request;
    const id = uuidv4();
    const now = new Date().toISOString();

    const user = {
      id,
      name,
      email,
      age,
      created_at: now,
      updated_at: now,
    };

    users.set(id, user);

    callback(null, user);
  },

  GetUser: (call, callback) => {
    const { id } = call.request;
    const user = users.get(id);

    if (!user) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: 'User not found',
      });
      return;
    }

    callback(null, user);
  },

  ListUsers: (call) => {
    const { page = 1, pageSize = 10 } = call.request;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const userList = Array.from(users.values()).slice(startIndex, endIndex);

    userList.forEach(user => call.write(user));
    call.end();
  },

  UpdateUser: (call, callback) => {
    const { id, name, email, age } = call.request;
    const user = users.get(id);

    if (!user) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: 'User not found',
      });
      return;
    }

    const updatedUser = {
      ...user,
      name: name || user.name,
      email: email || user.email,
      age: age || user.age,
      updated_at: new Date().toISOString(),
    };

    users.set(id, updatedUser);
    callback(null, updatedUser);
  },

  DeleteUser: (call, callback) => {
    const { id } = call.request;
    const user = users.get(id);

    if (!user) {
      callback(null, {
        success: false,
        message: 'User not found',
      });
      return;
    }

    users.delete(id);
    callback(null, {
      success: true,
      message: 'User deleted successfully',
    });
  },
};

// Chat Service Implementation
const chatService = {
  Chat: (call) => {
    call.on('data', (message) => {
      console.log(`Received message from ${message.user_id}: ${message.message}`);

      // Echo the message back with server timestamp
      const response = {
        ...message,
        timestamp: new Date().toISOString(),
        message: `Echo: ${message.message}`,
      };

      call.write(response);
    });

    call.on('end', () => {
      call.end();
    });

    call.on('error', (error) => {
      console.error('Chat stream error:', error);
    });
  },
};

// Echo Service Implementation
const echoService = {
  Echo: (call, callback) => {
    const request = call.request;
    callback(null, {
      ...request,
      echoed_at: new Date().toISOString(),
    });
  },

  EchoStream: (call) => {
    call.on('data', (request) => {
      const response = {
        ...request,
        echoed_at: new Date().toISOString(),
      };
      call.write(response);
    });

    call.on('end', () => {
      call.end();
    });
  },
};

// Create and start the server
function main() {
  const server = new grpc.Server();

  server.addService(testProto.HelloService.service, helloService);
  server.addService(testProto.UserService.service, userService);
  server.addService(testProto.ChatService.service, chatService);
  server.addService(testProto.EchoService.service, echoService);

  const port = '0.0.0.0:50051';
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('Failed to bind server:', error);
      return;
    }

    console.log(`Test gRPC server running on ${port}`);
    server.start();
  });
}

main();