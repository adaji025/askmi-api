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

### Brand
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
        url: `http://localhost:${process.env.PORT || 4000}`,
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
            instagramId: {
              type: 'string',
              nullable: true,
              description: 'Instagram user ID for accounts authenticated via Instagram',
            },
            authProvider: {
              type: 'string',
              enum: ['local', 'instagram'],
              description: 'Authentication provider used by the account',
              example: 'local',
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
            companyCAC: {
              type: 'string',
              nullable: true,
              description: 'Company CAC (default empty string)',
            },
            companySize: {
              type: 'string',
              nullable: true,
              description: 'Company size (for brands, default empty)',
              example: '11-50',
            },
            industry: {
              type: 'string',
              nullable: true,
              description: 'Industry (for brands, default empty)',
              example: 'Technology',
            },
            fullName: {
              type: 'string',
              description: 'User full name',
            },
            countryCode: {
              type: 'string',
              nullable: true,
              description: 'ISO country code (e.g., US, GB, CA)',
            },
            lang: {
              type: 'string',
              description: 'User language preference (default en)',
              example: 'en',
            },
            role: {
              type: 'string',
              enum: ['brand', 'admin', 'influencer'],
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
            countryCode: {
              type: 'string',
              nullable: true,
              example: 'US',
              description: 'ISO country code (e.g., US, GB, CA)',
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
              enum: ['brand', 'admin', 'influencer'],
              default: 'brand',
              example: 'brand',
            },
          },
        },
        InfluencerRegisterRequest: {
          type: 'object',
          required: ['email', 'fullName', 'password', 'confirmPassword', 'role'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'influencer@example.com',
            },
            phoneNumber: {
              type: 'string',
              example: '+1234567890',
            },
            company: {
              type: 'string',
              example: 'Creator Studio',
            },
            fullName: {
              type: 'string',
              example: 'Jane Influencer',
            },
            countryCode: {
              type: 'string',
              nullable: true,
              example: 'US',
              description: 'ISO country code (e.g., US, GB, CA)',
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
              enum: ['influencer'],
              example: 'influencer',
              description: 'Must be influencer for influencer registration',
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
        InstagramAuthRequest: {
          type: 'object',
          required: ['code'],
          properties: {
            code: {
              type: 'string',
              description:
                'Authorization code from Instagram OAuth redirect (query param `code`). The server exchanges it for an access token using app credentials and INSTAGRAM_REDIRECT_URI.',
              example: 'AQBx8...',
            },
            fullName: {
              type: 'string',
              description: 'Optional full name override for first-time signup',
              example: 'Jane Influencer',
            },
          },
        },
        InstagramAuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Instagram login successful',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            isNewUser: {
              type: 'boolean',
              example: false,
            },
            instagram: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: '17841400000000000',
                },
                username: {
                  type: 'string',
                  nullable: true,
                  example: 'creator_handle',
                },
              },
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
        Campaign: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Campaign unique identifier',
            },
            campaignName: {
              type: 'string',
              description: 'Campaign name',
            },
            description: {
              type: 'string',
              description: 'Campaign description',
            },
            surveySource: {
              type: 'string',
              enum: ['creating_new', 'use_existing_survey'],
              description: 'Survey source type',
            },
            targetAudience: {
              type: 'object',
              description: 'Target audience configuration',
              properties: {
                region: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                city: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                age: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                interest: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Required when type is "custom"',
                    },
                  },
                },
              },
            },
            totalVoteNeeded: {
              type: 'integer',
              description: 'Total number of votes needed',
              minimum: 1,
            },
            numberOfQuestions: {
              type: 'integer',
              description: 'Number of questions in the campaign survey',
              minimum: 0,
              example: 10,
            },
            totalQuestions: {
              type: 'integer',
              description: 'Alias of numberOfQuestions for API clients',
              minimum: 0,
              example: 10,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign start date (ISO 8601)',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Campaign end date (ISO 8601)',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the campaign is currently active',
              example: true,
            },
            isCompleted: {
              type: 'boolean',
              description: 'Whether the campaign has been completed',
              example: false,
            },
            numberOfInfluencer: {
              type: 'integer',
              description: 'Number of influencers assigned to the campaign',
              example: 0,
            },
            userId: {
              type: 'string',
              description: 'ID of the user who created the campaign',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Campaign last update date',
            },
            response: {
              type: 'integer',
              description: 'Total votes received from surveys associated with the campaign',
              example: 0,
            },
            surveys: {
              type: 'array',
              description: 'Surveys belonging to this campaign',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string', nullable: true },
                  questions: { type: 'array', items: { $ref: '#/components/schemas/SurveyQuestion' } },
                },
              },
            },
          },
        },
        CreateCampaignRequest: {
          type: 'object',
          required: ['campaignName', 'description', 'surveySource', 'targetAudience', 'totalVoteNeeded', 'startDate'],
          properties: {
            campaignName: {
              type: 'string',
              minLength: 2,
              example: 'Product Feedback Survey',
              description: 'Campaign name (min 2 characters)',
            },
            description: {
              type: 'string',
              minLength: 10,
              example: 'Collecting valuable customer insights about product features and usability',
              description: 'Campaign description (min 10 characters)',
            },
            surveySource: {
              type: 'string',
              enum: ['creating_new', 'use_existing_survey'],
              example: 'creating_new',
              description: 'Survey source type',
            },
            surveyId: {
              type: 'string',
              example: 'cm9x5abc123surveyid',
              description: 'Required when surveySource is "use_existing_survey". Must belong to the requester unless requester is admin.',
            },
            targetAudience: {
              type: 'object',
              required: ['region', 'city', 'age', 'interest'],
              properties: {
                region: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                      example: 'all',
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['US', 'UK'],
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                city: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                      example: 'all',
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['New York', 'London'],
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                age: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                      example: 'custom',
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['18-25', '26-35'],
                      description: 'Required when type is "custom"',
                    },
                  },
                },
                interest: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['all', 'custom'],
                      example: 'custom',
                    },
                    values: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['Technology', 'Fashion'],
                      description: 'Required when type is "custom"',
                    },
                  },
                },
              },
            },
            totalVoteNeeded: {
              type: 'integer',
              minimum: 1,
              example: 1000,
              description: 'Total number of votes needed (minimum 1)',
            },
            numberOfQuestions: {
              type: 'integer',
              minimum: 0,
              example: 10,
              description: 'Number of questions in the campaign survey (optional, default 0)',
            },
            totalQuestions: {
              type: 'integer',
              minimum: 0,
              example: 10,
              description: 'Alias for numberOfQuestions. Optional; if both are provided, values must match.',
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-02-01T10:00:00Z',
              description: 'Campaign start date in ISO 8601 format (must be in the future)',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-02-28T23:59:59Z',
              description: 'Campaign end date in ISO 8601 format (optional, must be on or after start date)',
            },
          },
        },
        CreateCampaignResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Campaign created successfully',
            },
            campaign: {
              $ref: '#/components/schemas/Campaign',
            },
          },
        },
        CreateSurveyRequest: {
          type: 'object',
          required: ['questions'],
          properties: {
            campaignId: {
              type: 'string',
              nullable: true,
              description: 'Optional campaign ID to attach immediately. If omitted, survey is created unattached and can be linked later.',
            },
            title: {
              type: 'string',
              description: 'Survey title',
              example: 'Customer Feedback Survey',
            },
            questions: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SurveyQuestion' },
            },
          },
        },
        UpdateSurveyRequest: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Survey title',
            },
            questions: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SurveyQuestion' },
            },
          },
        },
        SurveyQuestionOption: {
          type: 'object',
          required: ['id', 'text'],
          properties: {
            id: { type: 'integer' },
            text: { type: 'string' },
          },
        },
        SurveyQuestion: {
          type: 'object',
          required: ['type', 'title', 'id', 'order'],
          properties: {
            type: {
              type: 'string',
              enum: ['multiple-choice', 'yes-no', 'rating-scale', 'text'],
            },
            title: { type: 'string' },
            required: { type: 'boolean', default: false },
            id: { type: 'string' },
            order: { type: 'integer' },
            options: {
              type: 'array',
              items: { $ref: '#/components/schemas/SurveyQuestionOption' },
              description: 'Required for multiple-choice type only',
            },
          },
        },
        Survey: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            campaignId: { type: 'string', nullable: true, description: 'ID of the campaign this survey belongs to (nullable when unattached)' },
            title: { type: 'string', nullable: true },
            questions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SurveyQuestion' },
            },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
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
        name: 'Campaign',
        description: 'Campaign management endpoints',
      },
      {
        name: 'Survey',
        description: 'Survey creation and management endpoints',
      },
      {
        name: 'Budget',
        description: 'Budget config and estimate endpoints',
      },
      {
        name: 'Brand Statistics',
        description: 'Brand dashboard statistics and activity',
      },
      {
        name: 'Analytics',
        description: 'Brand analytics - full dashboard data',
      },
      {
        name: 'Admin',
        description: 'Admin-only endpoints (brands, etc.)',
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
