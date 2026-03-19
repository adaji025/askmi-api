import type { Request, Response } from 'express';
import {
  pricePerUnitVoteSchema,
  budgetEstimateParamsSchema,
} from '../validators/budgetValidators.js';
import { budgetService } from '../services/budgetService.js';

export class BudgetController {
  /**
   * POST /api/budget - Set price per unit vote
   */
  async setPricePerUnitVote(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const validationResult = pricePerUnitVoteSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const config = await budgetService.setPricePerUnitVote(
        validationResult.data.pricePerUnitVote
      );

      res.status(201).json({
        success: true,
        message: 'Price per unit vote set successfully',
        budget: config,
      });
    } catch (error) {
      console.error('Budget set error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while setting budget config',
        });
      }
    }
  }

  /**
   * GET /api/budget - Get current price per unit vote
   */
  async getPricePerUnitVote(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const config = await budgetService.getPricePerUnitVote();

      res.status(200).json({
        success: true,
        message: config.isDefault
          ? 'Using default price per unit vote until admin sets a value'
          : 'Budget config retrieved successfully',
        budget: config,
      });
    } catch (error) {
      console.error('Budget get error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while fetching budget config',
        });
      }
    }
  }

  /**
   * PUT /api/budget - Update price per unit vote
   */
  async updatePricePerUnitVote(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const validationResult = pricePerUnitVoteSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const config = await budgetService.updatePricePerUnitVote(
        validationResult.data.pricePerUnitVote
      );

      res.status(200).json({
        success: true,
        message: 'Price per unit vote updated successfully',
        budget: config,
      });
    } catch (error) {
      console.error('Budget update error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while updating budget config',
        });
      }
    }
  }

  /**
   * GET /api/budget/estimate - Get budget estimate with ±20% deviation
   * Query params: totalQuestions, desiredVote
   * Formula: Budget = Total Questions × Total Desired Votes
   */
  async getBudgetEstimate(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', 'application/json');

      const validationResult = budgetEstimateParamsSchema.safeParse({
        totalQuestions: req.query.totalQuestions,
        desiredVote: req.query.desiredVote,
      });

      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationResult.error.issues,
        });
        return;
      }

      const { totalQuestions, desiredVote } = validationResult.data;
      const estimate = budgetService.getBudgetEstimate(totalQuestions, desiredVote);

      res.status(200).json({
        success: true,
        message: 'Budget estimate calculated successfully',
        estimate,
      });
    } catch (error) {
      console.error('Budget estimate error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'An error occurred while calculating budget estimate',
        });
      }
    }
  }
}

export const budgetController = new BudgetController();
