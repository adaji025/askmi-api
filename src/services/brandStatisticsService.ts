import { prisma } from '../index.js';

export interface BrandStatsSummary {
  activeCampaigns: number;
  totalResponses: number;
  totalSurveys: number;
  completionRate: number; // percentage 0-100
}

export interface ActiveCampaignWithProgress {
  id: string;
  campaignName: string;
  status: 'active' | 'completed';
  responseCount: number;
  totalVoteNeeded: number;
  progressPercent: number;
}

export interface RecentActivityItem {
  id: string;
  message: string;
  campaignId: string;
  campaignName: string;
  responseCount: number;
  createdAt: Date;
  timeAgo: string;
}

export class BrandStatisticsService {
  /**
   * Get summary stats for a brand (user)
   */
  async getStatsSummary(userId: string): Promise<BrandStatsSummary> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: {
        id: true,
        isActive: true,
        totalVoteNeeded: true,
      },
    });

    const campaignIds = campaigns.map((c) => c.id);

    const [responseCounts, surveyCount] = await Promise.all([
      prisma.surveyResponse.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds } },
        _count: { id: true },
      }),
      prisma.survey.count({
        where: { campaignId: { in: campaignIds } },
      }),
    ]);

    const countMap = new Map(responseCounts.map((r) => [r.campaignId, r._count.id]));
    const activeCampaigns = campaigns.filter((c) => c.isActive).length;
    const totalResponses = responseCounts.reduce((sum, r) => sum + r._count.id, 0);
    const totalVotesNeeded = campaigns.reduce((sum, c) => sum + c.totalVoteNeeded, 0);
    const completionRate =
      totalVotesNeeded > 0 ? Math.round((totalResponses / totalVotesNeeded) * 100) : 0;

    return {
      activeCampaigns,
      totalResponses,
      totalSurveys: surveyCount,
      completionRate: Math.min(completionRate, 100),
    };
  }

  /**
   * Get active campaigns with progress for a brand
   */
  async getActiveCampaignsWithProgress(
    userId: string,
    limit = 10
  ): Promise<ActiveCampaignWithProgress[]> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        campaignName: true,
        totalVoteNeeded: true,
        isCompleted: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    if (campaigns.length === 0) return [];

    const campaignIds = campaigns.map((c) => c.id);
    const responseCounts = await prisma.surveyResponse.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });
    const countMap = new Map(responseCounts.map((r) => [r.campaignId, r._count.id]));

    return campaigns.map((c) => {
      const responseCount = countMap.get(c.id) ?? 0;
      const progressPercent =
        c.totalVoteNeeded > 0
          ? Math.min(Math.round((responseCount / c.totalVoteNeeded) * 100), 100)
          : 0;

      return {
        id: c.id,
        campaignName: c.campaignName,
        status: c.isCompleted || responseCount >= c.totalVoteNeeded ? 'completed' : 'active',
        responseCount,
        totalVoteNeeded: c.totalVoteNeeded,
        progressPercent,
      };
    });
  }

  /**
   * Get recent activity - includes campaign creation and response milestones
   * New campaigns (0 responses) appear as "Campaign X was created"
   * Campaigns with responses appear as "Campaign X reached Y responses"
   */
  async getRecentActivity(userId: string, limit = 10): Promise<RecentActivityItem[]> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true, campaignName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (campaigns.length === 0) return [];

    const campaignIds = campaigns.map((c) => c.id);

    const [counts, latestResponses] = await Promise.all([
      prisma.surveyResponse.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds } },
        _count: { id: true },
      }),
      prisma.surveyResponse.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: campaignIds } },
        _max: { createdAt: true },
      }),
    ]);

    const countMap = new Map(counts.map((c) => [c.campaignId, c._count.id]));
    const lastResponseMap = new Map(
      latestResponses.map((r) => [r.campaignId, r._max.createdAt])
    );

    const activityItems: Array<{
      campaignId: string;
      campaignName: string;
      responseCount: number;
      activityDate: Date;
      message: string;
    }> = [];

    for (const c of campaigns) {
      const responseCount = countMap.get(c.id) ?? 0;
      const lastResponse = lastResponseMap.get(c.id);
      const activityDate = lastResponse ?? c.createdAt;
      const message =
        responseCount > 0
          ? `${c.campaignName} reached ${responseCount.toLocaleString()} responses`
          : `${c.campaignName} was created`;

      activityItems.push({
        campaignId: c.id,
        campaignName: c.campaignName,
        responseCount,
        activityDate,
        message,
      });
    }

    activityItems.sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());

    return activityItems.slice(0, limit).map((item, i) => ({
      id: `activity-${item.campaignId}-${i}`,
      message: item.message,
      campaignId: item.campaignId,
      campaignName: item.campaignName,
      responseCount: item.responseCount,
      createdAt: item.activityDate,
      timeAgo: formatTimeAgo(item.activityDate),
    }));
  }

  /**
   * Get all brand statistics in one call (stats + active campaigns + recent activity)
   */
  async getAll(
    userId: string,
    options?: { campaignsLimit?: number; activityLimit?: number }
  ): Promise<{
    stats: BrandStatsSummary;
    activeCampaigns: ActiveCampaignWithProgress[];
    recentActivity: RecentActivityItem[];
  }> {
    const campaignsLimit = options?.campaignsLimit ?? 10;
    const activityLimit = options?.activityLimit ?? 10;

    const [stats, activeCampaigns, recentActivity] = await Promise.all([
      this.getStatsSummary(userId),
      this.getActiveCampaignsWithProgress(userId, campaignsLimit),
      this.getRecentActivity(userId, activityLimit),
    ]);

    return {
      stats,
      activeCampaigns,
      recentActivity,
    };
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export const brandStatisticsService = new BrandStatisticsService();
