import { prisma } from '../index.js';
import { brandStatisticsService } from './brandStatisticsService.js';
import { budgetService } from './budgetService.js';
import type {
  BrandStatsSummary,
  ActiveCampaignWithProgress,
  RecentActivityItem,
} from './brandStatisticsService.js';

export interface VoteCollectionPoint {
  month: string; // "Jan", "Feb", etc.
  year: number;
  voteCount: number;
  monthIndex: number; // 1-12 for sorting
}

export interface CampaignTableRow {
  id: string;
  campaignName: string;
  status: 'active' | 'completed';
  responses: number;
  completionRate: number;
  costPerResponse: number;
  influencers: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyticsResponse {
  stats: BrandStatsSummary & {
    totalVotes: number;
    avgResponseRate: number;
    totalSpend: number;
  };
  voteCollectionOverTime: VoteCollectionPoint[];
  campaigns: CampaignTableRow[];
  activeCampaigns: ActiveCampaignWithProgress[];
  recentActivity: RecentActivityItem[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getConfidence(completionRate: number): 'high' | 'medium' | 'low' {
  if (completionRate >= 80) return 'high';
  if (completionRate >= 50) return 'medium';
  return 'low';
}

export class AnalyticsService {
  async getAll(
    userId: string,
    options?: {
      campaignsLimit?: number;
      activityLimit?: number;
      chartYear?: number; // Year for vote collection chart, default current year
    }
  ): Promise<AnalyticsResponse> {
    const campaignsLimit = options?.campaignsLimit ?? 50;
    const activityLimit = options?.activityLimit ?? 20;
    const chartYear = options?.chartYear ?? new Date().getFullYear();

    const priceConfig = await budgetService.getPricePerUnitVote();
    const pricePerUnitVote = priceConfig.pricePerUnitVote;

    const [baseStats, campaigns, voteCollectionOverTime] = await Promise.all([
      this.getEnhancedStats(userId, pricePerUnitVote),
      this.getCampaignsTable(userId, pricePerUnitVote),
      this.getVoteCollectionOverTime(userId, chartYear),
    ]);

    const [activeCampaigns, recentActivity] = await Promise.all([
      brandStatisticsService.getActiveCampaignsWithProgress(userId, campaignsLimit),
      brandStatisticsService.getRecentActivity(userId, activityLimit),
    ]);

    return {
      stats: baseStats,
      voteCollectionOverTime,
      campaigns,
      activeCampaigns,
      recentActivity,
    };
  }

  private async getEnhancedStats(userId: string, pricePerUnitVote: number): Promise<
    BrandStatsSummary & {
      totalVotes: number;
      avgResponseRate: number;
      totalSpend: number;
    }
  > {
    const stats = await brandStatisticsService.getStatsSummary(userId);

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true, totalVoteNeeded: true },
    });
    const campaignIds = campaigns.map((c) => c.id);

    const responseCounts = await prisma.surveyResponse.groupBy({
      by: ['campaignId'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });
    const countMap = new Map(responseCounts.map((r) => [r.campaignId, r._count.id]));

    let totalResponseRate = 0;
    let campaignsWithTarget = 0;
    for (const c of campaigns) {
      const count = countMap.get(c.id) ?? 0;
      if (c.totalVoteNeeded > 0) {
        totalResponseRate += (count / c.totalVoteNeeded) * 100;
        campaignsWithTarget++;
      }
    }
    const avgResponseRate =
      campaignsWithTarget > 0 ? Math.round(totalResponseRate / campaignsWithTarget) : 0;
    const totalSpend = Math.round(stats.totalResponses * pricePerUnitVote * 100) / 100;

    return {
      ...stats,
      totalVotes: stats.totalResponses,
      avgResponseRate: Math.min(avgResponseRate, 100),
      totalSpend,
    };
  }

  private async getVoteCollectionOverTime(
    userId: string,
    year: number
  ): Promise<VoteCollectionPoint[]> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);
    if (campaignIds.length === 0) {
      return MONTH_NAMES.map((month, i) => ({
        month,
        year,
        voteCount: 0,
        monthIndex: i + 1,
      }));
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const responses = await prisma.surveyResponse.findMany({
      where: {
        campaignId: { in: campaignIds },
        createdAt: { gte: startOfYear, lte: endOfYear },
      },
      select: { createdAt: true },
    });

    const monthCounts = new Map<number, number>();
    for (let i = 1; i <= 12; i++) monthCounts.set(i, 0);

    for (const r of responses) {
      const month = r.createdAt.getMonth() + 1;
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }

    return MONTH_NAMES.map((month, i) => ({
      month,
      year,
      voteCount: monthCounts.get(i + 1) ?? 0,
      monthIndex: i + 1,
    }));
  }

  private async getCampaignsTable(
    userId: string,
    pricePerUnitVote: number
  ): Promise<CampaignTableRow[]> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: {
        id: true,
        campaignName: true,
        isActive: true,
        isCompleted: true,
        totalVoteNeeded: true,
        numberOfInfluencer: true,
      },
      orderBy: { updatedAt: 'desc' },
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
      const responses = countMap.get(c.id) ?? 0;
      const completionRate =
        c.totalVoteNeeded > 0
          ? Math.min(Math.round((responses / c.totalVoteNeeded) * 100), 100)
          : 0;
      const costPerResponse = responses > 0 ? Math.round(pricePerUnitVote * 100) / 100 : 0;

      return {
        id: c.id,
        campaignName: c.campaignName,
        status: c.isCompleted || responses >= c.totalVoteNeeded ? 'completed' : 'active',
        responses,
        completionRate,
        costPerResponse,
        influencers: c.numberOfInfluencer,
        confidence: getConfidence(completionRate),
      };
    });
  }
}

export const analyticsService = new AnalyticsService();
