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

  async placeOrder(): Promise<KrakenOrderResponse> {
    // get pair data
    const { pairError, pairData } = await kraken.getPair(this.krakenTicker);
    if (pairError.length > 0) {
      console.log(`Pair data for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(`Pair data for ${this.krakenTicker} not available on Kraken`);
    }

    // get pair price info for order
    const { priceError, priceData } = await kraken.getPrice(this.krakenTicker);
    if (priceError.length > 0) {
      console.log(`Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(`Price info for ${this.krakenTicker} not available on Kraken`);
    }

    // const { orderBookError, orderBookData } = await kraken.getOrderBook(this.krakenTicker);

    // btc or eth price for calculations (we're currently placing orders in fixed USD amount)
    const assetClass = this.krakenTicker.includes('XBT') ? 'XBTUSDT' : 'ETHUSDT';
    const { priceError: assetClassError, priceData: assetClassData } = await kraken.getPrice(
      assetClass
    );
    if (assetClassError.length > 0) {
      console.log(`Asset Class Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResponse(
        `Asset Class Price info for ${this.krakenTicker} not available on Kraken`
      );
    }

    const { balanceError, balanceData } = await kraken.getBalance();
    if (balanceError.length > 0) {
      console.log(`Could not find balance info for ${this.krakenTicker} on Kraken`);
      return new KrakenOrderResponse(
        `Could not find balance info for ${this.krakenTicker} on Kraken`
      );
    }

    const { openOrderError, openOrderData } = await kraken.getOpenOrders();

    // set up the order
    const order = new KrakenOrderDetails(
      this.requestBody,
      this.krakenTicker,
      pairData,
      priceData,
      assetClassData,
      balanceData,
      openOrderData
    );

    // execute the order
    if (order.closeOnly) {
      const closeOrderResult = await kraken.handleLeveragedOrder(order, true, true);
      return closeOrderResult;
    }

    return await kraken.openOrder(order);
  }
}
