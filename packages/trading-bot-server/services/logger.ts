import { KrakenOrderResponse } from '../models/kraken/KrakenResults';

export function logOrderResult(comment: string, response: KrakenOrderResponse | undefined) {
  if (response && response.error.length > 0) {
    console.log(`${comment}: ERROR ${response?.error}`);
  } else {
    console.log(`${comment}: ${response?.result?.descr.order}`);
  }
}
