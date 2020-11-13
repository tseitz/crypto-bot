export interface KrakenTradeablePair {
  [index: string]: {
    aclass_base: string;
    aclass_quote: string;
    altname: string;
    base: string;
    fee_volume_currency: string;
    fees: number[][];
    fees_maker: number[][];
    leverage_buy: number[];
    leverage_sell: number[];
    lot: string;
    lot_decimals: number;
    lot_multiplier: number;
    margin_call: number;
    margin_stop: number;
    ordermin: string | number; // comes as string but is float
    pair_decimals: number;
    quote: string;
    wsname: string;
  };
}
