import { Request, Response, NextFunction } from 'express';
import { UserSettingsSchema } from '../../../core/domain/user-settings.js';
import { UserSettingsServicePort } from '../../../core/ports/inbound/user-settings.service.port.js';

export class SettingsController {
  constructor(private readonly service: UserSettingsServicePort) {}

  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.service.getSettings(req.userId!));
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = UserSettingsSchema.parse(req.body);
      res.json(await this.service.updateSettings(req.userId!, settings));
    } catch (err) {
      next(err);
    }
  };
}
