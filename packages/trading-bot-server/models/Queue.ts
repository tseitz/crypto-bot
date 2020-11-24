import { Response } from 'express';
import { TradingViewBody } from './TradingViewBody';

export interface Queue {
  body: TradingViewBody;
  res: Response;
}
