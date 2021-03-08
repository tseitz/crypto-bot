interface KrakenOrderProps {
  pair: string;
  krakenizedPair: string;
  type: 'buy' | 'sell';
  ordertype: 'market' | 'limit';
  price: number;
  volume: number;
  leverage?: number;
}

export class KrakenOrder {
  pair: string;
  krakenizedPair: string;
  type: 'buy' | 'sell';
  ordertype: 'market' | 'limit';
  price: number;
  volume: number;
  leverage?: number;
  validate?: boolean;

  constructor(attrs: KrakenOrderProps, switchType?: 'market' | 'limit') {
    this.pair = attrs.pair;
    this.krakenizedPair = attrs.krakenizedPair;
    this.type = attrs.type;
    this.ordertype = switchType ? switchType : attrs.ordertype;
    this.price = attrs.price;
    this.volume = attrs.volume;
    this.leverage = attrs.leverage;
    // this.validate = true;
  }
}
