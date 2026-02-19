import type { Request, Response } from 'express';
import { registerSchema, loginSchema } from '../validators/authValidators.js';
import { userService } from '../services/userService.js';
import { jwtService } from '../services/jwtService.js';

export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
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

      const { email, phoneNumber, company, fullName, password, role } = validationResult.data;

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
        password,
        role,
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
      res.status(500).json({
        success: false,
        message: 'An error occurred during registration',
      });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
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
      res.status(500).json({
        success: false,
        message: 'An error occurred during login',
      });
    }
  }
}

export const authController = new AuthController();
