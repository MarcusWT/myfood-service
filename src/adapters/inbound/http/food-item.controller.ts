import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { FoodItemServicePort } from '../../../core/ports/inbound/food-item.service.port.js';
import {
  CreateFoodItemSchema,
  UpdateFoodItemSchema,
  FoodItemFilterSchema,
  DisposeFoodItemSchema,
} from '../../../core/domain/food-item.js';
import { PaginationSchema } from '../../../core/domain/pagination.js';

const IdParamSchema = z.string().uuid();

export class FoodItemController {
  constructor(private readonly service: FoodItemServicePort) {}

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = CreateFoodItemSchema.parse(req.body);
      const item = await this.service.addItem(req.userId!, input);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  };

  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      const item = await this.service.getItem(id, req.userId!);
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  listItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = FoodItemFilterSchema.parse(req.query);
      const pagination = PaginationSchema.parse(req.query);
      const result = await this.service.listItemsPaginated(req.userId!, filter, pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      const input = UpdateFoodItemSchema.parse(req.body);
      const item = await this.service.updateItem(id, req.userId!, input);
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  disposeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      const { outcome } = DisposeFoodItemSchema.parse(req.body);
      const item = await this.service.disposeItem(id, req.userId!, outcome);
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      await this.service.removeItem(id, req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
