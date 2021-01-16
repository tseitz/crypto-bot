export interface TradingViewBody {
  passphrase: string;
  time: string;
  exchange: string;
  ticker: string;
  interval: string;
  strategy: TradingViewStrategyBody;
}

export interface TradingViewStrategyBody {
  action: string;
  description: string;
  price: string;
  txId?: string;
  buyBags?: number;
  sellBags?: number;
  bagSize?: number;
  positionSize?: number;
  validate?: boolean;
}
