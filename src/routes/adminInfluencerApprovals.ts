import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * @swagger
 * /api/admin/approve-influencer/{id}:
 *   post:
 *     summary: Approve influencer account (Admin only)
 *     description: Admin can approve an influencer account to grant them access to the platform
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Influencer user ID
 *     responses:
 *       200:
 *         description: Influencer approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Influencer approved successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: User is not an influencer or already approved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: User not found
 */
router.post('/approve-influencer/:id', async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'influencer') {
      return res.status(400).json({
        success: false,
        message: 'User is not an influencer',
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Influencer is already approved',
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        company: true,
        companyCAC: true,
        fullName: true,
        countryCode: true,
        lang: true,
        role: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Influencer approved successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Approve influencer error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while approving influencer',
    });
  }
});

export default router;
