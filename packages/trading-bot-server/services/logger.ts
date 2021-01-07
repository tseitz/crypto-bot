import { KrakenOrderResponse } from '../models/kraken/KrakenResults';

export function logOrderResult(
  comment: string,
  response: KrakenOrderResponse | undefined,
  ticker?: string
) {
  if (response && response.error?.length > 0) {
    console.log(`${ticker ? ticker : 'Hi There'}: ${response?.error}`);
  } else if (response?.result?.descr.order) {
    console.log(`${comment}: ${response?.result?.descr.order}`);
  } else {
    console.log(comment);
  }
}
