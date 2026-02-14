import { z } from 'zod';

// Registration validation schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().optional(),
  company: z.string().optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  role: z.enum(['user', 'admin', 'influencer']).optional().default('user'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
