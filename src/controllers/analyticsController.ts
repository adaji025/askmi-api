import type { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService.js';

export class AnalyticsController {
  /**
   * GET /api/brand/analytics - All analytics data in one response
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const userId = req.user!.userId;
      const campaignsLimit = req.query.campaignsLimit
        ? Math.min(Number(req.query.campaignsLimit), 50)
        : 50;
      const activityLimit = req.query.activityLimit
        ? Math.min(Number(req.query.activityLimit), 50)
        : 20;
      const chartYear = req.query.chartYear ? Number(req.query.chartYear) : undefined;

      const data = await analyticsService.getAll(userId, {
        campaignsLimit,
        activityLimit,
        chartYear,
      });

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        ...data,
      });
    } catch (error) {
      console.error('Analytics error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching analytics',
        });
      }
    }
  }
}

export const analyticsController = new AnalyticsController();
