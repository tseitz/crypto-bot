// Response is what we receive from Kraken
// Result is what we handle internally
// currently do it this way so we can destructure result to human readable form e.g. { balance } = getBalance

export interface GenericResponse {
  error: string[];
  result: any;
}

export interface KrakenTradeablePairResponse {
  error: string[];
  result: KrakenTradeablePair;
}
export class KrakenTradeablePairResult {
  error: string[];
  pair: KrakenTradeablePair;

  constructor(response: KrakenTradeablePairResponse) {
    this.error = response.error;
    this.pair = response.result;
  }
}

export interface KrakenPriceResponse {
  error: string[];
  result: KrakenPrice;
}
export class KrakenPriceResult {
  error: string[];
  price: KrakenPrice;

  constructor(response: KrakenPriceResponse) {
    this.error = response.error;
    this.price = response.result;
  }
}

export interface KrakenBalanceResponse {
  error: string[];
  result: KrakenBalance;
}
export class KrakenBalanceResult {
  error: string[];
  balances: KrakenBalance;

  constructor(response: KrakenBalanceResponse) {
    this.error = response.error;
    this.balances = response.result;
  }
}

export interface KrakenOpenPositionResponse {
  error: string[];
  result: KrakenOpenPosition;
}
export class KrakenOpenPositionResult {
  error: string[];
  openPositions: KrakenOpenPosition;

  constructor(response: KrakenOpenPositionResponse) {
    this.error = response.error;
    this.openPositions = response.result;
  }
}

export interface KrakenOpenOrderResponse {
  error: string[];
  result: KrakenOpenOrders;
}
export class KrakenOpenOrderResult {
  error: string[];
  openOrders: KrakenOpenOrders;

  constructor(response: KrakenOpenOrderResponse) {
    this.error = response.error;
    this.openOrders = response.result;
  }
}

export interface KrakenOrderResponse {
  error: string[];
  result?: KrakenOrder;
}
export class KrakenOrderResult {
  error: string[];
  order: KrakenOrder | undefined;

  constructor(response: KrakenOrderResponse) {
    this.error = response.error;
    this.order = response.result;
  }
}

interface KrakenOrder {
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
export interface KrakenOpenOrders {
  open: {
    [index: string]: {
      cost: string;
      descr: KrakenOpenOrderDescription;
      expiretm: number;
      fee: string;
      limitprice: string;
      misc: string;
      oflags: string;
      opentm: number;
      price: string;
      refid: any; // came in as null, not sure
      starttm: number;
      status: string;
      stopprice: string;
      userref: number;
      vol: string;
      vol_exec: string;
    };
  };
}

interface KrakenOpenOrderDescription {
  close: string;
  leverage: string;
  order: string;
  ordertype: string;
  pair: string;
  price: string;
  price2: string;
  type: string;
}
