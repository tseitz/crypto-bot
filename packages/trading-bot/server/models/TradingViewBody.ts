export interface TradingViewBody {
  passphrase: string;
  ticker: string;
  strategy: TradingViewStrategyBody;
}

export interface TradingViewStrategyBody {
  action: string;
  description: string;
}
