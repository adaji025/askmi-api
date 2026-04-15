import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { registerSchema, loginSchema, instagramAuthSchema } from '../validators/authValidators.js';
import { userService } from '../services/userService.js';
import { jwtService } from '../services/jwtService.js';
import { instagramService } from '../services/instagramService.js';
import type { UserWithoutPassword } from '../services/userService.js';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      // Validate request body
      const validationResult = registerSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const { email, phoneNumber, company, fullName, countryCode, password, role } = validationResult.data;

      // Check if user already exists
      const userExists = await userService.userExists(email);

      if (userExists) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
        return;
      }

      // Create user
      const user = await userService.createUser({
        email,
        phoneNumber,
        company,
        fullName,
        countryCode,
        password,
        role: role as any,
      });

      // Return success response with appropriate message for influencers
      const message = user.role === 'influencer' && !user.isApproved
        ? 'User registered successfully. Your account is pending approval. You will be notified once an admin approves your account.'
        : 'User registered successfully';

      res.status(201).json({
        success: true,
        message,
        user,
      });
    } catch (error) {
      console.error('Registration error:', error);
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred during registration';
        const knownError = error as Error & { code?: string };
        
        // Check for specific error types
        if (knownError) {
          if (knownError.code === 'P2002' || knownError.message.includes('Unique constraint failed')) {
            statusCode = 409;
            errorMessage = 'User with this email already exists';
          } else if (knownError.code === 'P2022' || knownError.message.includes('column') || knownError.message.includes('does not exist')) {
            statusCode = 500;
            errorMessage = 'Database schema is out of sync. Please run Prisma migrations.';
          } else if (knownError.message.includes('Database connection failed')) {
            statusCode = 503; // Service Unavailable
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (knownError.message.includes('User with this email already exists')) {
            statusCode = 409;
            errorMessage = knownError.message;
          }
        }
        
        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Ensure JSON content type
      res.setHeader('Content-Type', 'application/json');
      
      // Validate request body
      const validationResult = loginSchema.safeParse(req.body);

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const { email, password } = validationResult.data;

      // Find user by email
      const user = await userService.findByEmail(email);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // Verify password
      const isPasswordValid = await userService.verifyPassword(user.password, password);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // Return success response (exclude password)
      const userWithoutPassword = userService.getUserWithoutPassword(user);
      
      // Generate JWT token
      const token = jwtService.generateToken(userWithoutPassword);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred during login';
        
        // Check for specific error types
        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503; // Service Unavailable
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.includes('Invalid email or password')) {
            statusCode = 401;
            errorMessage = error.message;
          }
        }
        
        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }

  /**
   * Instagram sign in / sign up (influencers only)
   * POST /api/auth/instagram
   */
  async instagramAuth(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const validationResult = instagramAuthSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const { code, fullName } = validationResult.data;

      const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim();
      if (!redirectUri) {
        res.status(500).json({
          success: false,
          message: 'Server misconfiguration: INSTAGRAM_REDIRECT_URI is not set',
        });
        return;
      }

      const accessToken = await instagramService.exchangeCodeForToken(code, redirectUri);
      const instagramProfile = await instagramService.getProfile(accessToken);
      const syntheticEmail = `instagram_${instagramProfile.id}@instagram.local`;

      // Primary lookup by provider id; fallback to legacy synthetic-email users.
      const existingUser =
        (await userService.findByInstagramId(instagramProfile.id)) ||
        (await userService.findByEmail(syntheticEmail));

      if (existingUser && existingUser.role !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Instagram auth is restricted to influencer accounts',
        });
        return;
      }

      let isNewUser = false;
      let userWithoutPassword: UserWithoutPassword;

      if (!existingUser) {
        const generatedPassword = randomBytes(24).toString('hex');
        const displayName = fullName || instagramProfile.username || `instagram_${instagramProfile.id}`;

        userWithoutPassword = await userService.createUser({
          email: syntheticEmail,
          instagramId: instagramProfile.id,
          authProvider: 'instagram',
          fullName: displayName,
          password: generatedPassword,
          role: 'influencer',
        });
        isNewUser = true;
      } else {
        // Keep compatibility with existing rows created before provider fields existed.
        if (!existingUser.instagramId) {
          await userService.updateUserAuthProvider(existingUser.id, {
            instagramId: instagramProfile.id,
            authProvider: 'instagram',
          });
        }
        userWithoutPassword = userService.getUserWithoutPassword(existingUser);
      }

      const token = jwtService.generateToken(userWithoutPassword);

      res.status(200).json({
        success: true,
        message: isNewUser
          ? 'Instagram influencer account created successfully. Your account is pending approval.'
          : 'Instagram login successful',
        user: userWithoutPassword,
        token,
        isNewUser,
        instagram: {
          id: instagramProfile.id,
          username: instagramProfile.username || null,
        },
      });
    } catch (error) {
      console.error('Instagram auth error:', error);
      if (!res.headersSent) {
        let statusCode = 500;
        let errorMessage = 'An error occurred during Instagram authentication';

        if (error instanceof Error) {
          if (error.message.includes('Database connection failed')) {
            statusCode = 503;
            errorMessage = 'Database connection failed. Please try again later.';
          } else if (error.message.includes('Instagram OAuth is not configured')) {
            statusCode = 500;
            errorMessage = error.message;
          } else if (error.message.startsWith('INSTAGRAM_OAUTH_ERROR:')) {
            statusCode = 401;
            errorMessage = 'Invalid or expired Instagram authorization code';
          } else {
            errorMessage = error.message;
          }
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
        });
      }
    }
  }
}

export const authController = new AuthController();
