export interface StrategyParamsJson {
  [index: string]: StrategyParams;
}

export interface StrategyParams {
  leverage: number;
  entrySize: number;
  addSize?: number;
  initialAdds?: number;
  maxAdds?: number;
  latestResult: number;
  totalTrades: number;
  percentProfitable: number;
  avgTrade: number;
}
