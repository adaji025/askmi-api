import bcrypt from 'bcrypt';
import { prisma } from '../index.js';
import type { UserRole } from '@prisma/client';

export interface CreateUserData {
  email: string;
  phoneNumber?: string | null;
  company?: string | null;
  fullName: string;
  password: string;
  role?: UserRole;
}

export interface UserWithoutPassword {
  id: string;
  email: string;
  phoneNumber: string | null;
  company: string | null;
  fullName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Check if user exists by email
   */
  async userExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<UserWithoutPassword> {
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        company: data.company || null,
        fullName: data.fullName,
        password: hashedPassword,
        role: data.role || 'user',
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        company: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
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
