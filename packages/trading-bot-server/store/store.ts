import KrakenOrderDetails from '../models/kraken/KrakenOrderDetails';

interface OrderLog {
  [index: string]: KrakenOrderDetails[];
}

export const trades: OrderLog = {};
