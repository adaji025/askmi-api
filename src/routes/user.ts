import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import type { Request, Response } from 'express';
import { prisma } from '../index.js';

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

// GET /api/user/profile - Get current user profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile',
    });
  }
});

// GET /api/user/admin-only - Admin only route example
router.get('/admin-only', authorize('admin'), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'This is an admin-only route',
    user: req.user,
  });
});

export default router;
