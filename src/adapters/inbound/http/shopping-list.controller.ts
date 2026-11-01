import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ShoppingListServicePort } from '../../../core/ports/inbound/shopping-list.service.port.js';
import {
  CreateShoppingListItemSchema,
  UpdateShoppingListItemSchema,
} from '../../../core/domain/shopping-list.js';

const IdParamSchema = z.string().uuid();

export class ShoppingListController {
  constructor(private readonly service: ShoppingListServicePort) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.service.list(req.userId!));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = CreateShoppingListItemSchema.parse(req.body);
      res.status(201).json(await this.service.add(req.userId!, input));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      const patch = UpdateShoppingListItemSchema.parse(req.body);
      res.json(await this.service.update(req.userId!, id, patch));
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = IdParamSchema.parse(req.params.id);
      await this.service.remove(req.userId!, id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  clearChecked = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.service.clearChecked(req.userId!));
    } catch (err) {
      next(err);
    }
  };

  importFromSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(201).json(await this.service.importFromSummary(req.userId!));
    } catch (err) {
      next(err);
    }
  };
}
