import type { Request, Response } from 'express';
import { brandStatisticsService } from '../services/brandStatisticsService.js';

export class BrandStatisticsController {
  /**
   * GET /api/brand/statistics - All brand statistics in one response
   * (stats summary + active campaigns + recent activity)
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const userId = req.user!.userId;
      const campaignsLimit = req.query.campaignsLimit
        ? Math.min(Number(req.query.campaignsLimit), 50)
        : 10;
      const activityLimit = req.query.activityLimit
        ? Math.min(Number(req.query.activityLimit), 50)
        : 10;

      const data = await brandStatisticsService.getAll(userId, {
        campaignsLimit,
        activityLimit,
      });

      res.status(200).json({
        success: true,
        message: 'Brand statistics retrieved successfully',
        ...data,
      });
    } catch (error) {
      console.error('Brand statistics error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching brand statistics',
        });
      }
    }
  }
}

export const brandStatisticsController = new BrandStatisticsController();
