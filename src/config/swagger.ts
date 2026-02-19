import swaggerJsdoc from 'swagger-jsdoc';
import type { SwaggerDefinition } from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AskMI Backend API',
      version: '1.0.0',
      description: `API documentation for AskMI Backend - User authentication and management system

## Role-Based Access Control

### Admin
- Full access to all endpoints
- Can manage all users (CRUD)
- Can access system settings and analytics
- Bypasses all ownership checks

### Influencer
- Can view and edit own profile
- Can manage own content (full CRUD)
- Can view others' content (read-only)
- Cannot view other users' profiles
- Cannot access admin endpoints

### User
- Can view and edit own profile
- Can create, edit, and delete own content
- Can view others' content (read-only)
- Cannot modify others' content or profiles
- Cannot access admin endpoints`,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User unique identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            phoneNumber: {
              type: 'string',
              nullable: true,
              description: 'User phone number',
            },
            company: {
              type: 'string',
              nullable: true,
              description: 'User company name',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'influencer'],
              description: 'User role',
            },
            isApproved: {
              type: 'boolean',
              description: 'Account approval status. Influencers start as false and require admin approval.',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update date',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'fullName', 'password', 'confirmPassword'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            phoneNumber: {
              type: 'string',
              example: '+1234567890',
            },
            company: {
              type: 'string',
              example: 'Acme Corp',
            },
            fullName: {
              type: 'string',
              example: 'John Doe',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'password123',
            },
            confirmPassword: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'influencer'],
              default: 'user',
              example: 'user',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
        RegisterResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'User registered successfully',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Login successful',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication endpoints',
      },
      {
        name: 'User',
        description: 'User profile and management endpoints',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/index.ts',
    './dist/routes/*.js',
    './dist/index.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
