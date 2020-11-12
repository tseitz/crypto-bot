interface TradingViewBody {
  ticker: string;
  strategy: TradingViewStrategyBody;
}

interface TradingViewStrategyBody {
  action: string;
  description: string;
}