export interface KrakenOrderInfo {
  descr: KrakenOrderDescription;
  txid: string[];
}

interface KrakenOrderDescription {
  order: string;
}
