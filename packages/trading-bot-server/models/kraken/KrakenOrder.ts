import { KrakenOrderResponse } from './KrakenOrderResponse';
import { TradingViewBody } from '../TradingViewBody';
import { kraken } from '../../services/krakenService';
import KrakenOrderDetails from './KrakenOrderDetails';

export class KrakenOrder {
  requestBody: TradingViewBody;
  tradingViewTicker: string;
  krakenTicker: string;

  constructor(requestBody: TradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
    // Kraken uses XBT instead of BTC. Uniswap uses WETH instead of ETH
    // I use binance/uniswap for most webhooks since there is more volume
    this.krakenTicker = this.tradingViewTicker
      .replace('BTC', 'XBT')
      .replace('WETH', 'ETH')
      .replace('USDT', 'USD');
  }

  async placeOrder() {
    // get pair data
    const { error: pairError, pair } = await kraken.getPair(this.krakenTicker);
    if (pairError.length > 0) {
      console.log(`Pair data for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(`Pair data for ${this.krakenTicker} not available on Kraken`);
    }

    // get pair price info for order
    const { error: priceError, price } = await kraken.getPrice(this.krakenTicker);
    if (priceError.length > 0) {
      console.log(`Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(`Price info for ${this.krakenTicker} not available on Kraken`);
    }

    // const { orderBookError, orderBookData } = await kraken.getOrderBook(this.krakenTicker);

    // btc or eth price for calculations (we're currently placing orders in fixed USD amount)
    const assetClass = this.krakenTicker.includes('XBT') ? 'XBTUSDT' : 'ETHUSDT';
    const { error: assetClassError, price: assetClassPrice } = await kraken.getPrice(assetClass);
    if (assetClassError.length > 0) {
      console.log(`Asset Class Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(
        `Asset Class Price info for ${this.krakenTicker} not available on Kraken`
      );
    }

    const { error: balanceError, balance } = await kraken.getBalance();
    if (balanceError.length > 0) {
      console.log(`Could not find balance info for ${this.krakenTicker} on Kraken`);
      return new KrakenOrderResponse(
        `Could not find balance info for ${this.krakenTicker} on Kraken`
      );
    }

    const { openOrders } = await kraken.getOpenOrders();

    // set up the order
    const order = new KrakenOrderDetails(
      this.requestBody,
      this.krakenTicker,
      pair,
      price,
      assetClassPrice,
      balance,
      openOrders
    );

    // execute the order
    return await kraken.openOrder(order);
  }
}
