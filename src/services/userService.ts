import bcrypt from 'bcrypt';
import { prisma } from '../index.js';
import type { UserRole, AuthProvider, Prisma } from '@prisma/client';

export interface CreateUserData {
  email: string;
  instagramId?: string | null;
  authProvider?: AuthProvider;
  phoneNumber?: string | null;
  company?: string | null;
  fullName: string;
  countryCode?: string | null;
  password: string;
  role?: UserRole;
}

export interface UserWithoutPassword {
  id: string;
  email: string;
  instagramId: string | null;
  authProvider: AuthProvider;
  phoneNumber: string | null;
  company: string | null;
  companyCAC: string | null;
  companySize: string | null;
  industry: string | null;
  fullName: string;
  instagramDemographics: unknown | null;
  countryCode: string | null;
  lang: string;
  role: UserRole;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateAuthProviderData {
  instagramId?: string | null;
  authProvider?: AuthProvider;
}

export class UserService {
  private readonly defaultInstagramDemographics = {
    ageRange: [
      { label: '25 - 34', percentage: 100 },
    ],
    language: [
      { label: 'English', percentage: 100 },
    ],
    gender: [
      { label: 'Female', percentage: 100 },
    ],
    primaryLocation: [
      { countryCode: 'IL', countryName: 'Israel', percentage: 100 },
    ],
  };
  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error: any) {
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      throw error;
    }
  }

  /**
   * Find user by Instagram ID
   */
  async findByInstagramId(instagramId: string) {
    try {
      return await prisma.user.findUnique({
        where: { instagramId },
      });
    } catch (error: any) {
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      throw error;
    }
  }

  /**
   * Check if user exists by email
   */
  async userExists(email: string): Promise<boolean> {
    try {
      const user = await this.findByEmail(email);
      return user !== null;
    } catch (error: any) {
      // Re-throw connection errors with better message
      if (error?.message?.includes('Database connection failed')) {
        throw error;
      }
      const wrappedError = new Error(`Failed to check if user exists: ${error?.message || 'Unknown error'}`);
      if (error?.code) {
        (wrappedError as any).code = error.code;
      }
      throw wrappedError;
    }
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<UserWithoutPassword> {
    try {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      // Create user
      // Influencers start as unapproved, others are approved by default
      const isApproved = data.role !== 'influencer';
      
      const user = await prisma.user.create({
        data: {
          email: data.email,
          instagramId: data.instagramId || null,
          authProvider: data.authProvider || 'local',
          phoneNumber: data.phoneNumber || null,
          company: data.company || null,
          fullName: data.fullName,
          ...(data.role === 'influencer'
            ? { instagramDemographics: this.defaultInstagramDemographics as Prisma.InputJsonValue }
            : {}),
          countryCode: data.countryCode || null,
          password: hashedPassword,
          role: (data.role || 'brand') as UserRole,
          isApproved,
        },
        select: {
          id: true,
          email: true,
          instagramId: true,
          authProvider: true,
          phoneNumber: true,
          company: true,
          companyCAC: true,
          companySize: true,
          industry: true,
          fullName: true,
          instagramDemographics: true,
          countryCode: true,
          lang: true,
          role: true,
          isApproved: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error: any) {
      console.error('UserService.createUser error:', error);
      
      // Handle database connection errors
      if (error?.code === 'P1001' || error?.message?.includes('getaddrinfo') || error?.message?.includes('EAI_AGAIN')) {
        throw new Error('Database connection failed. Please check your database server is running and accessible.');
      }
      
      // Re-throw with more context
      const errorMessage = error?.message || 'Unknown error';
      const prismaError = new Error(`Failed to create user: ${errorMessage}`);
      
      // Preserve Prisma error codes if available
      if (error?.code) {
        (prismaError as any).code = error.code;
      }
      
      throw prismaError;
    }
  }

  /**
   * Update auth provider metadata for a user
   */
  async updateUserAuthProvider(userId: string, data: UpdateAuthProviderData): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        instagramId: data.instagramId,
        authProvider: data.authProvider,
      },
    });
  }

  /**
   * Verify user password
   */
  async verifyPassword(userPassword: string, inputPassword: string): Promise<boolean> {
    return await bcrypt.compare(inputPassword, userPassword);
  }

  /**
   * Get user without password
   */
  getUserWithoutPassword(user: { password: string } & UserWithoutPassword): UserWithoutPassword {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const userService = new UserService();
