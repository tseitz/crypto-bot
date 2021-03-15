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

export interface KrakenTradeBalanceResponse {
  error: string[];
  result: KrakenTradeBalance;
}
export class KrakenTradeBalanceResult {
  error: string[];
  balances: KrakenTradeBalance;

  constructor(response: KrakenTradeBalanceResponse) {
    this.error = response.error;
    this.balances = this.getProperNamedTradeBalance(response.result);
  }

  // TODO: come back to this any
  getProperNamedTradeBalance(result: KrakenPoorlyNamedTradeBalance | any) {
    return new KrakenTradeBalance(result);
  }
}

// great naming kraken
interface KrakenPoorlyNamedTradeBalance {
  c: string; // cost basis of open positions
  e: string; // equity = trade balance + unrealized net profit/loss
  eb: string; // equivalent balance (combined balance of all currencies)
  m: string; // margin amount of open positions
  mf: string; // free margin = equity - initial margin (maximum margin available to open new positions)
  ml: string; // margin level = (equity / initial margin) * 100
  n: string; // unrealized net profit/loss of open positions
  tb: string; // trade balance (combined balance of all equity currencies)
  v: string; // current floating valuation of open positions
}

export class KrakenTradeBalance {
  costBasis: string; // cost basis of open positions
  equity: string; // equity = trade balance + unrealized net profit/loss
  totalBalances: string; // equivalent balance (combined balance of all currencies)
  openPositionMargin: string; // margin amount of open positions
  marginFree: string; // free margin = equity - initial margin (maximum margin available to open new positions)
  marginLevel: string; // margin level = (equity / initial margin) * 100
  unrealizedGains: string; // unrealized net profit/loss of open positions
  tradeBalance: string; // trade balance (combined balance of all equity currencies)
  openValuations: string; // current floating valuation of open positions

  constructor(result: KrakenPoorlyNamedTradeBalance) {
    this.costBasis = result.c;
    this.equity = result.e;
    this.totalBalances = result.eb;
    this.openPositionMargin = result.m;
    this.marginFree = result.mf;
    this.marginLevel = result.ml;
    this.unrealizedGains = result.n;
    this.tradeBalance = result.tb;
    this.openValuations = result.v;
  }
}

export class KrakenNightlyLog {
  date: string;
  realizedBalances: number;
  unrealizedGains: number;
  unrealizedBalances: number;

  constructor(balances: KrakenTradeBalance) {
    this.date = new Date().toJSON();
    this.realizedBalances = parseFloat(balances.totalBalances);
    this.unrealizedGains = parseFloat(balances.unrealizedGains);
    this.unrealizedBalances = this.realizedBalances + this.unrealizedGains;
  }
}

// export class LogKrakenTradeBalance extends KrakenTradeBalance {
//   date: string;

//   constructor(balances: KrakenTradeBalance) {
//     super(balances);
//     this.date = Date.now();
//   }
// }

export interface KrakenOpenPositionResponse {
  error: string[];
  result: KrakenOpenPositions;
}
export class KrakenOpenPositionResult {
  error: string[];
  openPositions: KrakenOpenPositions;

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

export interface KrakenOpenPositions {
  [index: string]: KrakenOpenPosition;
}

export interface KrakenOpenPosition {
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

// closetm:1615781180.6272
// cost:'0.000000'
// descr:{pair: 'LINKUSD', type: 'buy', ordertype: 'limit', price: '29.29841', price2: '0', …}
// expiretm:0
// fee:'0.000000'
// limitprice:'0.000000'
// misc:''
// oflags:'fciq'
// opentm:1615781180.6269
// price:'0.000000'
// reason:'Insufficient margin'
// refid:null
// starttm:0
// status:'canceled'
// stopprice:'0.000000'
// userref:0
// vol:'1.55567485'
// vol_exec:'0.00000000'

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
