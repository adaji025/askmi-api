import { prisma } from '../index.js';

const DEVIATION_PERCENT = 0.2; // ±20%
export const DEFAULT_PRICE_PER_UNIT_VOTE = 0.5; // Used until admin sets a value

export interface BudgetConfigResponse {
  id: string | null;
  pricePerUnitVote: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  isDefault?: boolean; // true when using default (admin has not set a value yet)
}

export interface BudgetEstimateResponse {
  baseBudget: number;
  minBudget: number;
  maxBudget: number;
  totalQuestions: number;
  desiredVote: number;
  deviationPercent: number;
}

export class BudgetService {
  /**
   * POST: Create or set price per unit vote (upsert singleton)
   */
  async setPricePerUnitVote(pricePerUnitVote: number): Promise<BudgetConfigResponse> {
    const config = await prisma.budgetConfig.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        pricePerUnitVote,
      },
      update: {
        pricePerUnitVote,
      },
    });

    return {
      id: config.id,
      pricePerUnitVote: Number(config.pricePerUnitVote),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * GET: Retrieve current price per unit vote.
   * Returns default value when admin has not set one yet.
   */
  async getPricePerUnitVote(): Promise<BudgetConfigResponse> {
    const config = await prisma.budgetConfig.findUnique({
      where: { key: 'default' },
    });

    if (!config) {
      return {
        id: null,
        pricePerUnitVote: DEFAULT_PRICE_PER_UNIT_VOTE,
        createdAt: null,
        updatedAt: null,
        isDefault: true,
      };
    }

    return {
      id: config.id,
      pricePerUnitVote: Number(config.pricePerUnitVote),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * PUT: Update price per unit vote (creates config if not exists)
   */
  async updatePricePerUnitVote(pricePerUnitVote: number): Promise<BudgetConfigResponse> {
    const config = await prisma.budgetConfig.upsert({
      where: { key: 'default' },
      create: {
        key: 'default',
        pricePerUnitVote,
      },
      update: {
        pricePerUnitVote,
      },
    });

    return {
      id: config.id,
      pricePerUnitVote: Number(config.pricePerUnitVote),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * GET estimate: Budget = Total Questions × Total Desired Votes with ±20% deviation
   */
  getBudgetEstimate(totalQuestions: number, desiredVote: number): BudgetEstimateResponse {
    const baseBudget = totalQuestions * desiredVote;
    const minBudget = Math.round(baseBudget * (1 - DEVIATION_PERCENT));
    const maxBudget = Math.round(baseBudget * (1 + DEVIATION_PERCENT));

    return {
      baseBudget,
      minBudget,
      maxBudget,
      totalQuestions,
      desiredVote,
      deviationPercent: DEVIATION_PERCENT * 100,
    };
  }
}

export const budgetService = new BudgetService();
