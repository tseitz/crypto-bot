import { KrakenPriceInfo } from './KrakenPriceInfo';
import { KrakenTradeablePair } from './KrakenTradeablePair';

export interface KrakenTradeablePairResult {
  error: string[];
  result: KrakenTradeablePair;
}

export interface KrakenPriceInfoResult {
  error: string[];
  result: KrakenPriceInfo;
}
