import { Router, type Request, type Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { prisma } from '../index.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get admin dashboard statistics (Admin only)
 *     description: Returns app-wide dashboard statistics and monthly vote collection trend.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chartYear
 *         required: false
 *         schema:
 *           type: integer
 *         description: Year for monthly vote collection chart (default current year)
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const chartYearRaw = Array.isArray(req.query.chartYear) ? req.query.chartYear[0] : req.query.chartYear;
    const chartYearParsed = typeof chartYearRaw === 'string' ? Number(chartYearRaw) : undefined;
    const chartYear: number =
      typeof chartYearParsed === 'number' && Number.isFinite(chartYearParsed)
        ? chartYearParsed
        : new Date().getFullYear();

    const [
      totalUsers,
      totalBrands,
      totalInfluencers,
      activeCampaigns,
      pendingCampaigns,
      completedCampaigns,
      totalVotes,
      campaignTargets,
      ocrReviewCounts,
      ocrQueueCounts,
      reviewedTodayResultImages,
      influencerUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'brand' } }),
      prisma.user.count({ where: { role: 'influencer' } }),
      prisma.campaign.count({ where: { isActive: true, isCompleted: false } }),
      prisma.campaign.count({ where: { isActive: false, isCompleted: false } }),
      prisma.campaign.count({ where: { isCompleted: true } }),
      prisma.surveyResponse.count(),
      prisma.campaign.aggregate({ _sum: { totalVoteNeeded: true } }),
      prisma.campaignResultImage.groupBy({
        by: ['reviewStatus'],
        _count: { _all: true },
      }),
      prisma.campaignResultImage.groupBy({
        by: ['reviewStatus'],
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _count: { _all: true },
      }),
      prisma.campaignResultImage.findMany({
        where: {
          reviewStatus: {
            in: ['approved', 'rejected'],
          },
          reviewedAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 6)),
          },
        },
        select: {
          reviewStatus: true,
          reviewedAt: true,
        },
      }),
      prisma.user.findMany({
        where: {
          role: 'influencer',
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      }),
    ]);

    const totalVoteTarget = campaignTargets._sum.totalVoteNeeded ?? 0;
    const voteDelivery = totalVoteTarget > 0
      ? Number(((totalVotes / totalVoteTarget) * 100).toFixed(2))
      : 0;

    const approvedOcr = ocrReviewCounts.find((row) => row.reviewStatus === 'approved')?._count._all ?? 0;
    const rejectedOcr = ocrReviewCounts.find((row) => row.reviewStatus === 'rejected')?._count._all ?? 0;
    const reviewedOcrTotal = approvedOcr + rejectedOcr;
    const ocrAccuracy = reviewedOcrTotal > 0
      ? Number(((approvedOcr / reviewedOcrTotal) * 100).toFixed(2))
      : 0;
    const approvedToday = ocrQueueCounts.find((row) => row.reviewStatus === 'approved')?._count._all ?? 0;
    const rejectedToday = ocrQueueCounts.find((row) => row.reviewStatus === 'rejected')?._count._all ?? 0;
    const pendingReview = await prisma.campaignResultImage.count({
      where: {
        reviewStatus: 'pending',
      },
    });
    const processedToday = approvedToday + rejectedToday;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const ocrAccuracyTrendMap = new Map<number, { approved: number; reviewed: number }>();
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      ocrAccuracyTrendMap.set(day.getDay(), { approved: 0, reviewed: 0 });
    }
    for (const row of reviewedTodayResultImages) {
      if (!row.reviewedAt) continue;
      const dayIndex = row.reviewedAt.getDay();
      const current = ocrAccuracyTrendMap.get(dayIndex) ?? { approved: 0, reviewed: 0 };
      current.reviewed += 1;
      if (row.reviewStatus === 'approved') {
        current.approved += 1;
      }
      ocrAccuracyTrendMap.set(dayIndex, current);
    }
    const ocrAccuracyTrend = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const stats = ocrAccuracyTrendMap.get(day.getDay()) ?? { approved: 0, reviewed: 0 };
      return {
        day: WEEKDAY_NAMES[day.getDay()],
        date: day.toISOString().slice(0, 10),
        reviewedCount: stats.reviewed,
        ocrAccuracy: stats.reviewed > 0 ? Number(((stats.approved / stats.reviewed) * 100).toFixed(2)) : 0,
      };
    });

    const influencerIds = influencerUsers.map((row) => row.id);
    const influencerVotes = influencerIds.length > 0
      ? await prisma.campaignResultImage.groupBy({
        by: ['influencerId'],
        where: {
          influencerId: {
            in: influencerIds,
          },
          reviewStatus: 'approved',
          reviewedVotes: {
            not: null,
          },
        },
        _sum: {
          reviewedVotes: true,
        },
      })
      : [];
    const voteMap = new Map<string, number>(
      influencerVotes.map((row) => [row.influencerId, row._sum.reviewedVotes ?? 0]),
    );
    const influencerPerformance = influencerUsers.map((user) => ({
      influencerId: user.id,
      fullName: user.fullName,
      handle: user.email.split('@')[0] ? `@${user.email.split('@')[0]}` : null,
      totalVotes: voteMap.get(user.id) ?? 0,
    }));
    const totalInfluencerVotes = influencerPerformance.reduce((sum, row) => sum + row.totalVotes, 0);
    const averageInfluencerVotes = influencerPerformance.length > 0
      ? totalInfluencerVotes / influencerPerformance.length
      : 0;
    const withDeviation = influencerPerformance.map((row) => {
      const deviation = averageInfluencerVotes > 0
        ? Number((((row.totalVotes - averageInfluencerVotes) / averageInfluencerVotes) * 100).toFixed(2))
        : 0;
      return {
        ...row,
        deviationPercent: deviation,
      };
    });
    const topPerformers = [...withDeviation]
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 5);
    const underPerformingInfluencers = [...withDeviation]
      .sort((a, b) => a.totalVotes - b.totalVotes)
      .slice(0, 5);

    const startOfYear = new Date(chartYear, 0, 1);
    const endOfYear = new Date(chartYear, 11, 31, 23, 59, 59, 999);
    const yearlyVotes = await prisma.surveyResponse.findMany({
      where: {
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const monthVoteMap = new Map<number, number>();
    for (let i = 1; i <= 12; i++) {
      monthVoteMap.set(i, 0);
    }
    for (const vote of yearlyVotes) {
      const month = vote.createdAt.getMonth() + 1;
      monthVoteMap.set(month, (monthVoteMap.get(month) ?? 0) + 1);
    }

    const voteCollectionOverTime = MONTH_NAMES.map((month, index) => ({
      month,
      monthIndex: index + 1,
      year: chartYear,
      voteCount: monthVoteMap.get(index + 1) ?? 0,
    }));

    return res.status(200).json({
      success: true,
      message: 'Admin dashboard statistics retrieved successfully',
      stats: {
        users: {
          totalUsers,
          brands: totalBrands,
          influencers: totalInfluencers,
        },
        campaigns: {
          activeCampaigns,
          pendingCampaigns,
          completedCampaigns,
        },
        votes: {
          totalVotes,
          totalVoteTarget,
          voteDelivery,
        },
        ocr: {
          reviewedCount: reviewedOcrTotal,
          approvedCount: approvedOcr,
          rejectedCount: rejectedOcr,
          ocrAccuracy,
        },
      },
      voteCollectionOverTime,
      ocrQueue: {
        processedToday,
        autoVerified: approvedToday,
        pendingReview,
        flaggedFraud: rejectedToday,
      },
      ocrAccuracyTrend,
      topPerformers,
      underPerformingInfluencers,
    });
  } catch (error) {
    console.error('Get admin dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching admin dashboard statistics',
    });
  }
});

export default router;
