export interface KrakenTradeablePairResult {
  error: string[];
  result: KrakenTradeablePair;
}

export interface KrakenPriceResult {
  error: string[];
  result: KrakenPrice;
}

export interface KrakenBalanceResult {
  error: string[];
  result: KrakenBalance;
}

export interface KrakenOpenPositionResult {
  error: string[];
  result: KrakenOpenPosition;
}

export interface KrakenOrderResult {
  descr: KrakenOrderDescription;
  txid: string[];
}

interface KrakenOrderDescription {
  order: string;
}

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
    ordermin: number | string; // comes as string but is float
    pair_decimals: number;
    quote: string;
    wsname: string;
  };
}

// TODO: make these fixed length arrays
export interface KrakenPrice {
  [index: string]: {
    a: string[]; // a:(3) ['16235.70000', '1', '1.000']
    b: string[]; // b:(3) ['16229.80000', '1', '1.000']
    c: string[]; // c:(2) ['16227.60000', '0.01123332']
    h: string[]; // h:(2) ['16472.00000', '16472.00000']
    l: string[]; // l:(2) ['15960.00000', '15873.00000']
    o: string; // o:'16299.90000'
    p: string[]; // p:(2) ['16278.12122', '16235.30168']
    t: number[]; // t:(2) [1767, 2353]
    v: string[]; // v:(2) ['204.48735554', '261.89459523']
  };
}

export interface KrakenBalance {
  [index: string]: string;
}

export interface KrakenOpenPosition {
  [index: string]: {
    cost: string;
    fee: string;
    margin: string;
    misc: string;
    oflags: string;
    ordertxid: string;
    ordertype: string;
    pair: string;
    posstatus: string;
    rollovertm: string;
    terms: string;
    time: number;
    type: string;
    vol: string;
    vol_closed: string;
  };
}

// error:(0) []
// result:{count: 1}
// count:1
