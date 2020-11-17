import { KrakenPriceInfo } from './KrakenPriceInfo';
import { KrakenTradeablePair } from './KrakenTradeablePair';
import { KrakenOrderInfo } from './KrakenOrderInfo';

export interface KrakenTradeablePairResult {
  error: string[];
  result: KrakenTradeablePair;
}

export interface KrakenPriceInfoResult {
  error: string[];
  result: KrakenPriceInfo;
}

export interface KrakenOrderResult {
  error: string[];
  result: KrakenOrderInfo;
}
