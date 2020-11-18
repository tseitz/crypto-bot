export interface StrategyParamsJson {
  [index: string]: {
    name: string;
    smaLength: number;
    timeframe: string;
    latestResult: number;
    positionSize: number; // as a percent
  };
}

export interface StrategyParams {
  name: string;
  smaLength: number;
  timeframe: string;
  latestResult: number;
  positionSize: number; // as a percent
}
