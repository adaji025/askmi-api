import { prisma } from '../index.js';
import { budgetService } from './budgetService.js';

export const BRAND_SELECT = {
  id: true,
  email: true,
  phoneNumber: true,
  company: true,
  companyCAC: true,
  companySize: true,
  industry: true,
  fullName: true,
  countryCode: true,
  lang: true,
  role: true,
  isApproved: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type BrandSummary = {
  id: string;
  email: string;
  phoneNumber: string | null;
  company: string | null;
  companyCAC: string | null;
  companySize: string | null;
  industry: string | null;
  fullName: string;
  countryCode: string | null;
  lang: string;
  role: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminBrandWithMetrics = BrandSummary & {
  totalCampaign: number;
  activeCampaign: number;
  totalSpend: number;
};

/** Lightweight campaign row for admin single-brand view */
export type AdminBrandCampaignSummary = {
  id: string;
  campaignName: string;
};

/** Single-brand admin response: profile, metrics, campaign id + name only */
export type AdminBrandDetail = AdminBrandWithMetrics & {
  campaigns: AdminBrandCampaignSummary[];
};

/** Aggregate stats across all brand users’ campaigns */
export interface AdminBrandsStatistics {
  totalBrands: number;
  activeCampaigns: number;
  /** Campaigns that are not active and not completed (e.g. draft / not started) */
  pendingCampaigns: number;
  completedCampaigns: number;
  /** Sum of (votes × price per unit vote) for all brand campaigns */
  totalRevenue: number;
  totalVotes: number;
}

export interface AdminBrandsPayload {
  statistics: AdminBrandsStatistics;
  brands: AdminBrandWithMetrics[];
}

function mapCountByUser(
  rows: { userId: string; _count: { id: number } }[]
): Map<string, number> {
  return new Map(rows.map((r) => [r.userId, r._count.id]));
}

export class AdminBrandService {
  /**
   * Get all brand users (admin only), with per-brand metrics and aggregate statistics.
   * totalSpend / totalRevenue use total votes × current price per unit vote (same as brand analytics).
   * Per-brand activeCampaign: isActive && !isCompleted. Pending globally: !isActive && !isCompleted.
   */
  async getBrands(): Promise<AdminBrandsPayload> {
    const [brands, priceConfig] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'brand' },
        select: BRAND_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      budgetService.getPricePerUnitVote(),
    ]);

    const brandIds = brands.map((b) => b.id);
    const pricePerUnitVote = priceConfig.pricePerUnitVote;

    if (brandIds.length === 0) {
      return {
        statistics: {
          totalBrands: 0,
          activeCampaigns: 0,
          pendingCampaigns: 0,
          completedCampaigns: 0,
          totalRevenue: 0,
          totalVotes: 0,
        },
        brands: [],
      };
    }

    const [
      totalByUser,
      activeByUser,
      campaignRows,
      activeCampaigns,
      pendingCampaigns,
      completedCampaigns,
    ] = await Promise.all([
      prisma.campaign.groupBy({
        by: ['userId'],
        where: { userId: { in: brandIds } },
        _count: { id: true },
      }),
      prisma.campaign.groupBy({
        by: ['userId'],
        where: {
          userId: { in: brandIds },
          isActive: true,
          isCompleted: false,
        },
        _count: { id: true },
      }),
      prisma.campaign.findMany({
        where: { userId: { in: brandIds } },
        select: { id: true, userId: true },
      }),
      prisma.campaign.count({
        where: {
          userId: { in: brandIds },
          isActive: true,
          isCompleted: false,
        },
      }),
      prisma.campaign.count({
        where: {
          userId: { in: brandIds },
          isActive: false,
          isCompleted: false,
        },
      }),
      prisma.campaign.count({
        where: {
          userId: { in: brandIds },
          isCompleted: true,
        },
      }),
    ]);

    const totalMap = mapCountByUser(totalByUser);
    const activeMap = mapCountByUser(activeByUser);

    const campaignToUser = new Map(campaignRows.map((c) => [c.id, c.userId]));
    const campaignIds = campaignRows.map((c) => c.id);

    const responseCounts =
      campaignIds.length === 0
        ? []
        : await prisma.surveyResponse.groupBy({
            by: ['campaignId'],
            where: { campaignId: { in: campaignIds } },
            _count: { id: true },
          });

    const responsesByUser = new Map<string, number>();
    let totalVotes = 0;
    for (const row of responseCounts) {
      const userId = campaignToUser.get(row.campaignId);
      if (!userId) continue;
      const n = row._count.id;
      totalVotes += n;
      responsesByUser.set(userId, (responsesByUser.get(userId) ?? 0) + n);
    }

    const totalRevenue = Math.round(totalVotes * pricePerUnitVote * 100) / 100;

    const withMetrics: AdminBrandWithMetrics[] = brands.map((b) => {
      const totalResponses = responsesByUser.get(b.id) ?? 0;
      const totalSpend = Math.round(totalResponses * pricePerUnitVote * 100) / 100;
      return {
        ...b,
        totalCampaign: totalMap.get(b.id) ?? 0,
        activeCampaign: activeMap.get(b.id) ?? 0,
        totalSpend,
      };
    });

    return {
      statistics: {
        totalBrands: brands.length,
        activeCampaigns,
        pendingCampaigns,
        completedCampaigns,
        totalRevenue,
        totalVotes,
      },
      brands: withMetrics,
    };
  }

  /**
   * Get one brand by user id (admin only). Returns null if missing or not role brand.
   * campaigns: id and campaignName only, newest first.
   */
  async getBrandById(brandId: string): Promise<AdminBrandDetail | null> {
    const brand = await prisma.user.findFirst({
      where: { id: brandId, role: 'brand' },
      select: BRAND_SELECT,
    });

    if (!brand) {
      return null;
    }

    const [priceConfig, campaignRows] = await Promise.all([
      budgetService.getPricePerUnitVote(),
      prisma.campaign.findMany({
        where: { userId: brandId },
        select: {
          id: true,
          campaignName: true,
          isActive: true,
          isCompleted: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const pricePerUnitVote = priceConfig.pricePerUnitVote;
    const totalCampaign = campaignRows.length;
    const activeCampaign = campaignRows.filter((c) => c.isActive && !c.isCompleted).length;

    const campaignIds = campaignRows.map((c) => c.id);
    const responseCounts =
      campaignIds.length === 0
        ? []
        : await prisma.surveyResponse.groupBy({
            by: ['campaignId'],
            where: { campaignId: { in: campaignIds } },
            _count: { id: true },
          });
    const totalResponses = responseCounts.reduce((sum, r) => sum + r._count.id, 0);
    const totalSpend = Math.round(totalResponses * pricePerUnitVote * 100) / 100;

    const campaigns: AdminBrandCampaignSummary[] = campaignRows.map(({ id, campaignName }) => ({
      id,
      campaignName,
    }));

    return {
      ...brand,
      totalCampaign,
      activeCampaign,
      totalSpend,
      campaigns,
    };
  }
}

export const adminBrandService = new AdminBrandService();
