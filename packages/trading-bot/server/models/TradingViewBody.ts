export interface TradingViewBody {
  ticker: string;
  strategy: TradingViewStrategyBody;
}

export interface TradingViewStrategyBody {
  action: string;
  description: string;
}