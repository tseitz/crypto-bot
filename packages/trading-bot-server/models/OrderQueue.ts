import { Response } from 'express';
import { KrakenTradingViewBody } from './TradingViewBody';

export interface OrderQueue {
  body: KrakenTradingViewBody;
  res: Response;
}
