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

export class KrakenOrderResult {
  error: string[];
  result: KrakenOrder | undefined;

  constructor(error: string, result?: KrakenOrder) {
    this.error = [error];
    this.result = result;
  }
}

export interface KrakenBalanceResult {
  error: string[];
  result: KrakenBalance;
}
