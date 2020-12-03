export interface StrategyParamsJson {
  [index: string]: StrategyParams;
}

export interface StrategyParams {
  name: string;
  timeframe: string;
  allowShorts: boolean;
  addLong: boolean;
  reopenLong: boolean;
  rsiEntry: number;
  addLongRsi: number;
  entrySize: number;
  addSize: number;
  latestResult: number;
  totalTrades: number;
  percentProfitable: number;
  avgTrade: number;
}
