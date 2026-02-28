import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import campaignRoutes from './routes/campaign.js';
import { swaggerSpec } from './config/swagger.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 4000;

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// CORS middleware - must be before other middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // Allow all origins in development, set specific origin in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Middleware - Set JSON content type for all responses
app.use((req: Request, res: Response, next: NextFunction) => {
  // Set default content type to JSON (unless it's Swagger UI)
  if (!req.path.startsWith('/api-docs')) {
    res.setHeader('Content-Type', 'application/json');
  }
  next();
});

// Body parser middleware with error handling
app.use(express.json({
  strict: true,
}));

// Handle JSON parsing errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    // JSON parsing error
    res.setHeader('Content-Type', 'application/json');
    res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body',
      error: err.message,
    });
    return;
  }
  next(err);
});

// Swagger Documentation - Must be before other routes
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AskMI API Documentation',
  explorer: true,
};

// Swagger JSON endpoint (for debugging) - must be before swaggerUi.serve
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI setup - serve static files and setup UI
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerOptions));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/campaign', campaignRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Server is running
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware - must be after all routes
// This MUST have 4 parameters for Express to recognize it as an error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  console.error('Error stack:', err?.stack);
  
  // Force JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  // Ensure we always return JSON, never HTML
  if (!res.headersSent) {
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Internal server error',
      error: err.message || 'Unknown error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
      }),
    });
  } else {
    // If headers are already sent, we can't send JSON, but log it
    console.error('Headers already sent, cannot send error response');
  }
});

// 404 handler - must be last, after all routes and error handlers
app.use((req: Request, res: Response) => {
  // Explicitly set JSON content type
  res.setHeader('Content-Type', 'application/json');
  
  // Only send if headers haven't been sent
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.path,
      method: req.method,
    });
  }
});

async function main(): Promise<void> {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Server ready on port ${PORT}`);
      console.log(`📚 Swagger documentation: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Note: We don't disconnect here as the server should stay running
    // process.on('SIGINT', async () => {
    //   await prisma.$disconnect();
    //   process.exit(0);
    // });
  });

