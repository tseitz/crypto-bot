export interface StrategyParamsJson {
  [index: string]: StrategyParams;
}

export interface StrategyParams {
  entrySize: number;
  addSize: number;
  maxAdds?: number;
  latestResult: number;
  totalTrades: number;
  percentProfitable: number;
  avgTrade: number;
}
