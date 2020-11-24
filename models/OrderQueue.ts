import { Response } from 'express';
import { TradingViewBody } from './TradingViewBody';

export interface OrderQueue {
  body: TradingViewBody;
  res: Response;
}
