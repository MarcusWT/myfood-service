import { Request, Response, NextFunction } from 'express';
import { FoodItemServicePort } from '../../../core/ports/inbound/food-item.service.port.js';
import {
  CreateFoodItemSchema,
  UpdateFoodItemSchema,
  FoodItemFilterSchema,
} from '../../../core/domain/food-item.js';
import { PaginationSchema } from '../../../core/domain/pagination.js';

export class FoodItemController {
  constructor(private readonly service: FoodItemServicePort) {}

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = CreateFoodItemSchema.parse(req.body);
      const item = await this.service.addItem(input);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  };

  getItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await this.service.getItem(req.params.id);
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  listItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = FoodItemFilterSchema.parse(req.query);
      const pagination = PaginationSchema.parse(req.query);
      const result = await this.service.listItemsPaginated(filter, pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = UpdateFoodItemSchema.parse(req.body);
      const item = await this.service.updateItem(req.params.id, input);
      res.json(item);
    } catch (err) {
      next(err);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.removeItem(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
