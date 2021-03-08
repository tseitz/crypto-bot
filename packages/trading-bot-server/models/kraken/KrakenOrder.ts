export interface IKrakenOrder { 
  pair: string;
  type: 'buy' | 'sell';
  ordertype: string; // 'market' and 'limit'?
  price: number;
  volume: number;
  leverage: number;
}

export class KrakenOrder {
  pair: string;
  type: 'buy' | 'sell';
  ordertype: string; // 'market' and 'limit'?
  price: number;
  volume: number;
  leverage: number;

  constructor({ pair, type, ordertype, price, volume, leverage }: IKrakenOrder) {
    this.pair = pair;
    this.type = type;
    this.ordertype = ordertype;
    this.price = price;
    this.volume = volume;
    this.leverage = leverage;
  }
}
