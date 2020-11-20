export interface KrakenOrder {
  descr: KrakenOrderDescription;
  txid: string[];
}

interface KrakenOrderDescription {
  order: string;
}
