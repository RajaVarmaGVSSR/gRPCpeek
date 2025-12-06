const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const PORT = process.env.PORT || 50051;
const TLS_MODE = process.env.TLS_MODE || 'insecure'; // insecure, tls, mtls, self-signed
const PROTO_PATH = path.join(__dirname, 'proto');

// ============================================================================
// Logging Utilities
// ============================================================================

const LOG_COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function logRequest(serviceName, methodName, request, metadata) {
  console.log('');
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.bright}📥 INCOMING REQUEST${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.dim}${formatTimestamp()}${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.green}Service:${LOG_COLORS.reset} ${serviceName}`);
  console.log(`${LOG_COLORS.green}Method:${LOG_COLORS.reset}  ${methodName}`);
  
  if (metadata && Object.keys(metadata).length > 0) {
    console.log(`${LOG_COLORS.yellow}Metadata:${LOG_COLORS.reset}`);
    Object.entries(metadata).forEach(([key, value]) => {
      console.log(`  ${LOG_COLORS.dim}${key}:${LOG_COLORS.reset} ${value}`);
    });
  }
  
  console.log(`${LOG_COLORS.blue}Request:${LOG_COLORS.reset}`);
  console.log(JSON.stringify(request, null, 2));
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
}

function logResponse(serviceName, methodName, response, error = null) {
  console.log(`${LOG_COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.bright}📤 OUTGOING RESPONSE${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.dim}${formatTimestamp()}${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.green}Service:${LOG_COLORS.reset} ${serviceName}`);
  console.log(`${LOG_COLORS.green}Method:${LOG_COLORS.reset}  ${methodName}`);
  
  if (error) {
    console.log(`${LOG_COLORS.red}❌ Error:${LOG_COLORS.reset}`);
    console.log(`  ${LOG_COLORS.red}Code:${LOG_COLORS.reset} ${error.code || 'UNKNOWN'}`);
    console.log(`  ${LOG_COLORS.red}Message:${LOG_COLORS.reset} ${error.message || error}`);
    if (error.stack) {
      console.log(`${LOG_COLORS.dim}${error.stack}${LOG_COLORS.reset}`);
    }
  } else {
    console.log(`${LOG_COLORS.green}✅ Success${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.blue}Response:${LOG_COLORS.reset}`);
    console.log(JSON.stringify(response, null, 2));
  }
  
  console.log(`${LOG_COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log('');
}

function logStreamStart(serviceName, methodName, type) {
  console.log('');
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.bright}🔄 STREAM START${LOG_COLORS.reset} (${type})`);
  console.log(`${LOG_COLORS.dim}${formatTimestamp()}${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.green}Service:${LOG_COLORS.reset} ${serviceName}`);
  console.log(`${LOG_COLORS.green}Method:${LOG_COLORS.reset}  ${methodName}`);
  console.log(`${LOG_COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
}

function logStreamMessage(direction, message) {
  const arrow = direction === 'in' ? '📥' : '📤';
  const color = direction === 'in' ? LOG_COLORS.blue : LOG_COLORS.green;
  console.log(`${color}${arrow} Stream ${direction}:${LOG_COLORS.reset}`);
  console.log(JSON.stringify(message, null, 2));
}

function logStreamEnd(serviceName, methodName) {
  console.log(`${LOG_COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.bright}🏁 STREAM END${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.dim}${formatTimestamp()}${LOG_COLORS.reset}`);
  console.log(`${LOG_COLORS.green}Service:${LOG_COLORS.reset} ${serviceName}`);
  console.log(`${LOG_COLORS.green}Method:${LOG_COLORS.reset}  ${methodName}`);
  console.log(`${LOG_COLORS.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${LOG_COLORS.reset}`);
  console.log('');
}

// Middleware to wrap unary calls with logging
function withLogging(serviceName, methodName, handler) {
  return (call, callback) => {
    const metadata = call.metadata.getMap();
    logRequest(serviceName, methodName, call.request, metadata);
    
    handler(call, (error, response) => {
      logResponse(serviceName, methodName, response, error);
      callback(error, response);
    });
  };
}

// Middleware to wrap server-streaming calls with logging
function withServerStreamLogging(serviceName, methodName, handler) {
  return (call) => {
    const metadata = call.metadata.getMap();
    logStreamStart(serviceName, methodName, 'SERVER-STREAMING');
    logRequest(serviceName, methodName, call.request, metadata);
    
    const originalWrite = call.write.bind(call);
    const originalEnd = call.end.bind(call);
    
    call.write = (message) => {
      logStreamMessage('out', message);
      return originalWrite(message);
    };
    
    call.end = () => {
      logStreamEnd(serviceName, methodName);
      return originalEnd();
    };
    
    handler(call);
  };
}

// Middleware to wrap client-streaming calls with logging
function withClientStreamLogging(serviceName, methodName, handler) {
  return (call, callback) => {
    const metadata = call.metadata.getMap();
    logStreamStart(serviceName, methodName, 'CLIENT-STREAMING');
    if (Object.keys(metadata).length > 0) {
      console.log(`${LOG_COLORS.yellow}Metadata:${LOG_COLORS.reset}`);
      Object.entries(metadata).forEach(([key, value]) => {
        console.log(`  ${LOG_COLORS.dim}${key}:${LOG_COLORS.reset} ${value}`);
      });
    }
    
    const originalOn = call.on.bind(call);
    
    call.on = (event, listener) => {
      if (event === 'data') {
        return originalOn(event, (data) => {
          logStreamMessage('in', data);
          listener(data);
        });
      }
      return originalOn(event, listener);
    };
    
    handler(call, (error, response) => {
      logResponse(serviceName, methodName, response, error);
      logStreamEnd(serviceName, methodName);
      callback(error, response);
    });
  };
}

// Middleware to wrap bidirectional-streaming calls with logging
function withBidiStreamLogging(serviceName, methodName, handler) {
  return (call) => {
    const metadata = call.metadata.getMap();
    logStreamStart(serviceName, methodName, 'BIDIRECTIONAL-STREAMING');
    if (Object.keys(metadata).length > 0) {
      console.log(`${LOG_COLORS.yellow}Metadata:${LOG_COLORS.reset}`);
      Object.entries(metadata).forEach(([key, value]) => {
        console.log(`  ${LOG_COLORS.dim}${key}:${LOG_COLORS.reset} ${value}`);
      });
    }
    
    const originalOn = call.on.bind(call);
    const originalWrite = call.write.bind(call);
    const originalEnd = call.end.bind(call);
    
    call.on = (event, listener) => {
      if (event === 'data') {
        return originalOn(event, (data) => {
          logStreamMessage('in', data);
          listener(data);
        });
      }
      return originalOn(event, listener);
    };
    
    call.write = (message) => {
      logStreamMessage('out', message);
      return originalWrite(message);
    };
    
    call.end = () => {
      logStreamEnd(serviceName, methodName);
      return originalEnd();
    };
    
    handler(call);
  };
}

// Load all proto files
const PROTO_FILES = [
  'services/hello.proto',
  'services/user.proto',
  'services/chat.proto',
  'services/shop.proto',
  'services/auth.proto',
  'services/echo.proto',
];

console.log('Loading proto files from:', PROTO_PATH);

// Load proto definitions with includes
const packageDefinition = protoLoader.loadSync(
  PROTO_FILES.map(f => path.join(PROTO_PATH, f)),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_PATH], // Allow imports from proto directory
  }
);

const proto = grpc.loadPackageDefinition(packageDefinition);

// In-memory storage
const users = new Map();
const products = new Map();
const orders = new Map();
const chatRooms = new Map();
const sessions = new Map();

// Seed some initial data
function seedData() {
  // Create sample users
  const user1 = {
    id: uuidv4(),
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    status: 1, // ACTIVE
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      postal_code: '94102',
    },
    roles: ['user', 'admin'],
    preferences: { theme: 'dark', language: 'en' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  users.set(user1.id, user1);

  // Create sample products
  const product1 = {
    id: uuidv4(),
    name: 'Laptop',
    description: 'High-performance laptop',
    price: 999.99,
    currency: 'USD',
    stock_quantity: 50,
    category: 'Electronics',
    tags: ['computer', 'laptop', 'portable'],
    status: 1, // AVAILABLE
    attributes: { brand: 'TechCorp', warranty: '2 years' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  products.set(product1.id, product1);

  console.log('✅ Seeded initial data:', {
    users: users.size,
    products: products.size,
  });
}

// ============================================================================
// Service Implementations
// ============================================================================

// Hello Service (with logging wrappers)
const helloServiceImpl = {
  SayHello: (call, callback) => {
    const { name, language = 'en' } = call.request;
    const greetings = {
      en: `Hello ${name}!`,
      es: `¡Hola ${name}!`,
      fr: `Bonjour ${name}!`,
      de: `Hallo ${name}!`,
      ja: `こんにちは ${name}!`,
      zh: `你好 ${name}!`,
    };

    callback(null, {
      message: greetings[language] || greetings.en,
      timestamp: new Date().toISOString(),
      server_version: '2.0.0',
      language,
    });
  },

  SayHelloServerStream: (call) => {
    const { name, language = 'en' } = call.request;
    let count = 0;

    const interval = setInterval(() => {
      if (count >= 10) {
        clearInterval(interval);
        call.end();
        return;
      }

      call.write({
        message: `Hello ${name}! (streaming message ${count + 1})`,
        timestamp: new Date().toISOString(),
        server_version: '2.0.0',
        language,
      });
      count++;
    }, 2000); // Changed from 500ms to 2000ms (2 seconds) for easier testing
  },

  SayMultipleHellos: (call, callback) => {
    const { name, languages = ['en'] } = call.request;
    const greetings = {
      en: `Hello ${name}!`,
      es: `¡Hola ${name}!`,
      fr: `Bonjour ${name}!`,
      de: `Hallo ${name}!`,
    };

    const responses = languages.map(lang => ({
      message: greetings[lang] || greetings.en,
      timestamp: new Date().toISOString(),
      server_version: '2.0.0',
      language: lang,
    }));

    callback(null, { greetings: responses });
  },
};

const helloService = {
  SayHello: withLogging('HelloService', 'SayHello', helloServiceImpl.SayHello),
  SayHelloServerStream: withServerStreamLogging('HelloService', 'SayHelloServerStream', helloServiceImpl.SayHelloServerStream),
  SayMultipleHellos: withLogging('HelloService', 'SayMultipleHellos', helloServiceImpl.SayMultipleHellos),
};

// User Service (with logging wrappers)
const userServiceImpl = {
  CreateUser: (call, callback) => {
    const { name, email, age, address, roles = [] } = call.request;
    const id = uuidv4();
    const now = new Date().toISOString();

    const user = {
      id,
      name,
      email,
      age,
      status: 1, // ACTIVE
      address: address || {},
      roles,
      preferences: {},
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
        message: `User not found: ${id}`,
      });
      return;
    }

    callback(null, user);
  },

  ListUsers: (call) => {
    const { page = 1, page_size = 10, status } = call.request;
    const startIndex = (page - 1) * page_size;
    const endIndex = startIndex + page_size;

    let userList = Array.from(users.values());
    if (status && status !== 0) {
      userList = userList.filter(u => u.status === status);
    }

    userList.slice(startIndex, endIndex).forEach(user => call.write(user));
    call.end();
  },

  UpdateUser: (call, callback) => {
    const { id, name, email, age, status, address } = call.request;
    const user = users.get(id);

    if (!user) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: `User not found: ${id}`,
      });
      return;
    }

    const updatedUser = {
      ...user,
      name: name || user.name,
      email: email || user.email,
      age: age || user.age,
      status: status || user.status,
      address: address || user.address,
      updated_at: new Date().toISOString(),
    };

    users.set(id, updatedUser);
    callback(null, updatedUser);
  },

  DeleteUser: (call, callback) => {
    const { id } = call.request;
    const exists = users.has(id);

    if (!exists) {
      callback(null, {
        success: false,
        message: `User not found: ${id}`,
      });
      return;
    }

    users.delete(id);
    callback(null, {
      success: true,
      message: 'User deleted successfully',
    });
  },

  BatchGetUsers: (call, callback) => {
    const { ids = [] } = call.request;
    const foundUsers = [];
    const notFoundIds = [];

    ids.forEach(id => {
      const user = users.get(id);
      if (user) {
        foundUsers.push(user);
      } else {
        notFoundIds.push(id);
      }
    });

    callback(null, {
      users: foundUsers,
      not_found_ids: notFoundIds,
    });
  },

  SearchUsers: (call) => {
    const { query, limit = 100 } = call.request;
    const lowerQuery = query.toLowerCase();
    let count = 0;

    Array.from(users.values()).forEach(user => {
      if (count >= limit) return;
      
      if (
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
      ) {
        call.write(user);
        count++;
      }
    });

    call.end();
  },
};

const userService = {
  CreateUser: withLogging('UserService', 'CreateUser', userServiceImpl.CreateUser),
  GetUser: withLogging('UserService', 'GetUser', userServiceImpl.GetUser),
  ListUsers: withServerStreamLogging('UserService', 'ListUsers', userServiceImpl.ListUsers),
  UpdateUser: withLogging('UserService', 'UpdateUser', userServiceImpl.UpdateUser),
  DeleteUser: withLogging('UserService', 'DeleteUser', userServiceImpl.DeleteUser),
  BatchGetUsers: withLogging('UserService', 'BatchGetUsers', userServiceImpl.BatchGetUsers),
  SearchUsers: withServerStreamLogging('UserService', 'SearchUsers', userServiceImpl.SearchUsers),
};

// Chat Service (with logging wrappers)
const chatServiceImpl = {
  Chat: (call) => {
    call.on('data', (message) => {
      // Echo back with server timestamp
      const response = {
        ...message,
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        message: `Server echo: ${message.message}`,
      };

      call.write(response);
    });

    call.on('end', () => {
      call.end();
    });

    call.on('error', (error) => {
      console.error('❌ Chat error:', error);
    });
  },

  UploadMessages: (call, callback) => {
    let messageCount = 0;
    const userIds = new Set();
    let firstTime = null;
    let lastTime = null;

    call.on('data', (message) => {
      messageCount++;
      userIds.add(message.user_id);
      
      if (!firstTime) firstTime = message.timestamp;
      lastTime = message.timestamp;
    });

    call.on('end', () => {
      callback(null, {
        total_messages: messageCount,
        total_users: userIds.size,
        first_message_time: firstTime || new Date().toISOString(),
        last_message_time: lastTime || new Date().toISOString(),
      });
    });

    call.on('error', (error) => {
      console.error('❌ Upload error:', error);
      callback(error);
    });
  },

  SubscribeToRoom: (call) => {
    const { room_id, user_id } = call.request;

    // Send some sample messages
    for (let i = 1; i <= 5; i++) {
      setTimeout(() => {
        call.write({
          id: uuidv4(),
          user_id: 'server',
          user_name: 'Server',
          room_id,
          message: `Room message ${i}`,
          timestamp: new Date().toISOString(),
          type: 1, // TEXT
          metadata: {},
        });
      }, i * 1000);
    }

    setTimeout(() => {
      call.end();
    }, 6000);
  },
};

const chatService = {
  Chat: withBidiStreamLogging('ChatService', 'Chat', chatServiceImpl.Chat),
  UploadMessages: withClientStreamLogging('ChatService', 'UploadMessages', chatServiceImpl.UploadMessages),
  SubscribeToRoom: withServerStreamLogging('ChatService', 'SubscribeToRoom', chatServiceImpl.SubscribeToRoom),
};

// Shop Service (with logging wrappers)
const shopServiceImpl = {
  CreateProduct: (call, callback) => {
    const { name, description, price, currency, stock_quantity, category, tags = [] } = call.request;
    const id = uuidv4();
    const now = new Date().toISOString();

    const product = {
      id,
      name,
      description,
      price,
      currency: currency || 'USD',
      stock_quantity,
      category,
      tags,
      status: 1, // AVAILABLE
      attributes: {},
      created_at: now,
      updated_at: now,
    };

    products.set(id, product);
    callback(null, product);
  },

  GetProduct: (call, callback) => {
    const { id } = call.request;
    const product = products.get(id);

    if (!product) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: `Product not found: ${id}`,
      });
      return;
    }

    callback(null, product);
  },

  ListProducts: (call) => {
    const { page = 1, page_size = 10, category, min_price, max_price } = call.request;
    const startIndex = (page - 1) * page_size;
    const endIndex = startIndex + page_size;

    let productList = Array.from(products.values());
    
    if (category) {
      productList = productList.filter(p => p.category === category);
    }
    if (min_price) {
      productList = productList.filter(p => p.price >= min_price);
    }
    if (max_price) {
      productList = productList.filter(p => p.price <= max_price);
    }

    productList.slice(startIndex, endIndex).forEach(product => call.write(product));
    call.end();
  },

  CreateOrder: (call, callback) => {
    const { user_id, items = [], shipping_address } = call.request;
    const id = uuidv4();
    const now = new Date().toISOString();

    const orderItems = items.map(item => {
      const product = products.get(item.product_id);
      return {
        product_id: item.product_id,
        product_name: product ? product.name : 'Unknown',
        quantity: item.quantity,
        unit_price: product ? product.price : 0,
        subtotal: product ? product.price * item.quantity : 0,
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const order = {
      id,
      user_id,
      items: orderItems,
      total_amount: total,
      currency: 'USD',
      status: 1, // PENDING
      shipping_address: shipping_address || {},
      created_at: now,
      updated_at: now,
    };

    orders.set(id, order);
    callback(null, order);
  },

  GetOrder: (call, callback) => {
    const { id } = call.request;
    const order = orders.get(id);

    if (!order) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: `Order not found: ${id}`,
      });
      return;
    }

    callback(null, order);
  },

  TrackOrder: (call) => {
    const { order_id } = call.request;

    const statuses = [
      { status: 1, message: 'Order pending' },
      { status: 2, message: 'Order confirmed' },
      { status: 3, message: 'Order shipped' },
      { status: 4, message: 'Order delivered' },
    ];

    statuses.forEach((update, index) => {
      setTimeout(() => {
        call.write({
          order_id,
          status: update.status,
          message: update.message,
          timestamp: new Date().toISOString(),
        });

        if (index === statuses.length - 1) {
          call.end();
        }
      }, (index + 1) * 1000);
    });
  },

  BatchCreateProducts: (call, callback) => {
    let createdCount = 0;
    const productIds = [];
    const errors = [];

    call.on('data', (request) => {
      try {
        const { name, description, price, currency, stock_quantity, category, tags = [] } = request;
        const id = uuidv4();
        const now = new Date().toISOString();

        const product = {
          id,
          name,
          description,
          price,
          currency: currency || 'USD',
          stock_quantity,
          category,
          tags,
          status: 1,
          attributes: {},
          created_at: now,
          updated_at: now,
        };

        products.set(id, product);
        productIds.push(id);
        createdCount++;
      } catch (error) {
        errors.push(`Failed to create product: ${error.message}`);
      }
    });

    call.on('end', () => {
      callback(null, {
        total_created: createdCount,
        product_ids: productIds,
        errors,
      });
    });

    call.on('error', (error) => {
      console.error('❌ Batch create error:', error);
      callback(error);
    });
  },
};

const shopService = {
  CreateProduct: withLogging('ShopService', 'CreateProduct', shopServiceImpl.CreateProduct),
  GetProduct: withLogging('ShopService', 'GetProduct', shopServiceImpl.GetProduct),
  ListProducts: withServerStreamLogging('ShopService', 'ListProducts', shopServiceImpl.ListProducts),
  CreateOrder: withLogging('ShopService', 'CreateOrder', shopServiceImpl.CreateOrder),
  GetOrder: withLogging('ShopService', 'GetOrder', shopServiceImpl.GetOrder),
  TrackOrder: withServerStreamLogging('ShopService', 'TrackOrder', shopServiceImpl.TrackOrder),
  BatchCreateProducts: withClientStreamLogging('ShopService', 'BatchCreateProducts', shopServiceImpl.BatchCreateProducts),
};

// Auth Service (with logging wrappers)
const authServiceImpl = {
  Login: (call, callback) => {
    const { username, password, device_id } = call.request;

    // Simple mock authentication
    if (username && password) {
      const token = `token_${uuidv4()}`;
      const refreshToken = `refresh_${uuidv4()}`;
      
      const session = {
        access_token: token,
        refresh_token: refreshToken,
        user_id: uuidv4(),
        username,
        expires_at: Date.now() + 3600000, // 1 hour
      };

      sessions.set(token, session);

      callback(null, {
        success: true,
        access_token: token,
        refresh_token: refreshToken,
        expires_in: 3600,
        user: {
          id: session.user_id,
          username,
          email: `${username}@example.com`,
          roles: ['user'],
        },
        message: 'Login successful',
      });
    } else {
      callback(null, {
        success: false,
        message: 'Invalid credentials',
      });
    }
  },

  Logout: (call, callback) => {
    const { access_token } = call.request;
    const deleted = sessions.delete(access_token);

    callback(null, {
      success: deleted,
      message: deleted ? 'Logged out successfully' : 'Invalid token',
    });
  },

  RefreshToken: (call, callback) => {
    const { refresh_token } = call.request;

    // Find session by refresh token
    const session = Array.from(sessions.values()).find(s => s.refresh_token === refresh_token);

    if (session) {
      const newToken = `token_${uuidv4()}`;
      const newRefreshToken = `refresh_${uuidv4()}`;

      sessions.delete(session.access_token);
      session.access_token = newToken;
      session.refresh_token = newRefreshToken;
      session.expires_at = Date.now() + 3600000;
      sessions.set(newToken, session);

      callback(null, {
        access_token: newToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
      });
    } else {
      callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid refresh token',
      });
    }
  },

  ValidateToken: (call, callback) => {
    // Extract token from Authorization header (Bearer token)
    const metadata = call.metadata.getMap();
    const authHeader = metadata.authorization || '';
    
    // Parse "Bearer <token>" format
    let token = null;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove "Bearer " prefix
    }

    if (!token) {
      callback(null, {
        valid: false,
      });
      return;
    }

    const session = sessions.get(token);

    if (session && session.expires_at > Date.now()) {
      callback(null, {
        valid: true,
        user_id: session.user_id,
        roles: ['user'],
        expires_at: session.expires_at,
      });
    } else {
      callback(null, {
        valid: false,
      });
    }
  },
};

const authService = {
  Login: withLogging('AuthService', 'Login', authServiceImpl.Login),
  Logout: withLogging('AuthService', 'Logout', authServiceImpl.Logout),
  RefreshToken: withLogging('AuthService', 'RefreshToken', authServiceImpl.RefreshToken),
  ValidateToken: withLogging('AuthService', 'ValidateToken', authServiceImpl.ValidateToken),
};

// Echo Service (with logging wrappers)
const echoServiceImpl = {
  Echo: (call, callback) => {
    const request = call.request;
    const repeatCount = request.repeat_count || 1;

    callback(null, {
      ...request,
      echoed_at: new Date().toISOString(),
      echo_count: repeatCount,
    });
  },

  EchoStream: (call) => {
    call.on('data', (request) => {
      const response = {
        ...request,
        echoed_at: new Date().toISOString(),
        echo_count: 1,
      };
      call.write(response);
    });

    call.on('end', () => {
      call.end();
    });

    call.on('error', (error) => {
      console.error('❌ Echo stream error:', error);
    });
  },

  EchoDelayed: (call) => {
    const request = call.request;
    const delay = request.delay_ms || 1000;
    const repeatCount = request.repeat_count || 3;

    for (let i = 0; i < repeatCount; i++) {
      setTimeout(() => {
        call.write({
          ...request,
          echoed_at: new Date().toISOString(),
          echo_count: i + 1,
        });

        if (i === repeatCount - 1) {
          call.end();
        }
      }, delay * (i + 1));
    }
  },
};

const echoService = {
  Echo: withLogging('EchoService', 'Echo', echoServiceImpl.Echo),
  EchoStream: withBidiStreamLogging('EchoService', 'EchoStream', echoServiceImpl.EchoStream),
  EchoDelayed: withServerStreamLogging('EchoService', 'EchoDelayed', echoServiceImpl.EchoDelayed),
};

// ============================================================================
// Server Setup
// ============================================================================

function getServerCredentials() {
  const certsDir = path.join(__dirname, 'certs');

  switch (TLS_MODE) {
    case 'tls':
      console.log('🔒 Starting server with TLS...');
      return grpc.ServerCredentials.createSsl(
        fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
        [
          {
            cert_chain: fs.readFileSync(path.join(certsDir, 'server-cert.pem')),
            private_key: fs.readFileSync(path.join(certsDir, 'server-key.pem')),
          },
        ],
        false // Don't check client certificate
      );

    case 'mtls':
      console.log('🔐 Starting server with mTLS (mutual TLS)...');
      return grpc.ServerCredentials.createSsl(
        fs.readFileSync(path.join(certsDir, 'ca-cert.pem')),
        [
          {
            cert_chain: fs.readFileSync(path.join(certsDir, 'server-cert.pem')),
            private_key: fs.readFileSync(path.join(certsDir, 'server-key.pem')),
          },
        ],
        true // Require and verify client certificate
      );

    case 'self-signed':
      console.log('🔓 Starting server with self-signed certificate...');
      return grpc.ServerCredentials.createSsl(
        null, // No CA
        [
          {
            cert_chain: fs.readFileSync(path.join(certsDir, 'self-signed-cert.pem')),
            private_key: fs.readFileSync(path.join(certsDir, 'self-signed-key.pem')),
          },
        ],
        false
      );

    case 'insecure':
    default:
      console.log('⚠️  Starting server in INSECURE mode (no TLS)...');
      return grpc.ServerCredentials.createInsecure();
  }
}

function main() {
  seedData();

  const server = new grpc.Server();

  // Register all services
  server.addService(proto.services.HelloService.service, helloService);
  server.addService(proto.services.UserService.service, userService);
  server.addService(proto.services.ChatService.service, chatService);
  server.addService(proto.services.ShopService.service, shopService);
  server.addService(proto.services.AuthService.service, authService);
  server.addService(proto.services.EchoService.service, echoService);

  const address = `0.0.0.0:${PORT}`;
  const credentials = getServerCredentials();

  server.bindAsync(address, credentials, (error, port) => {
    if (error) {
      console.error('❌ Failed to bind server:', error);
      process.exit(1);
    }

    console.log('');
    console.log('========================================');
    console.log('  gRPCpeek Test Server');
    console.log('========================================');
    console.log(`🚀 Server running on: ${address}`);
    console.log(`🔐 TLS Mode: ${TLS_MODE.toUpperCase()}`);
    console.log('');
    console.log('📋 Available Services:');
    console.log('  - services.HelloService (unary, server-streaming)');
    console.log('  - services.UserService (CRUD operations)');
    console.log('  - services.ChatService (bidirectional, client-streaming)');
    console.log('  - services.ShopService (e-commerce)');
    console.log('  - services.AuthService (authentication)');
    console.log('  - services.EchoService (various payload types)');
    console.log('');
    console.log('💡 Use gRPCpeek to connect and test!');
    console.log('========================================');
    console.log('');

    server.start();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});

main();
