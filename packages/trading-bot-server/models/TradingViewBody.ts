export interface KrakenTradingViewBody {
  passphrase: string;
  time: string;
  exchange: string;
  ticker: string;
  interval: string;
  strategy: KrakenTradingViewStrategyBody;
}

export interface KrakenTradingViewStrategyBody {
  action: string;
  description: string;
  price: string;
  txId?: string;
  buyBags?: number;
  sellBags?: number;
  bagSize?: number;
  positionSize?: number;
  validate?: boolean;
  shortZone?: boolean;
}

export interface BinanceTradingViewBody {
  passphrase: string;
  time: string;
  exchange: string;
  ticker: string;
  interval: string;
  strategy: BinanceTradingViewStrategyBody;
}

export interface BinanceTradingViewStrategyBody {
  action: string;
  description: string;
  price: string;
}

// TODO: remove optional params. extend instead
// interface CloseTransactionIdBody extends TradingViewStrategyBody {
//   description: 'Close';
//   txId: string;
// }

// interface BagItBody extends TradingViewStrategyBody {
//   buyBags: number;
//   sellBags: number;
//   bagSize: number;
// }
