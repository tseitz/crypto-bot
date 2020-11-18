import { KrakenPrice } from './KrakenPrice';
import { KrakenTradeablePair } from './KrakenTradeablePair';
import { KrakenOrder } from './KrakenOrder';
import { KrakenBalance } from './KrakenBalance';

export interface KrakenTradeablePairResult {
  error: string[];
  result: KrakenTradeablePair;
}

export interface KrakenPriceResult {
  error: string[];
  result: KrakenPrice;
}

export interface KrakenOrderResult {
  error: string[];
  result: KrakenOrder;
}

export interface KrakenBalanceInfoResult {
  error: string[];
  result: KrakenBalance;
}
