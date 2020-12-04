import { KrakenOrderResponse } from '../models/kraken/KrakenResults';

export function logOrderResult(
  comment: string,
  response: KrakenOrderResponse | undefined,
  ticker?: string
) {
  if (response && response.error.length > 0) {
    console.log(`${ticker ? ticker : 'Hi There'}: ERROR ${response?.error}`);
  } else {
    console.log(`${comment}: ${response?.result?.descr.order}`);
  }
}
