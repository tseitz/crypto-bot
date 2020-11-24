import { KrakenOrderResult } from './KrakenResults';

export class KrakenOrderResponse {
  error: string[];
  result: KrakenOrderResult | undefined;

  constructor(error: string, result?: KrakenOrderResult) {
    this.error = [error];
    this.result = result;
  }
}
