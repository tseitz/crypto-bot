import { KrakenOrderResponse, KrakenOrderResult } from './KrakenResults';
import { TradingViewBody } from '../TradingViewBody';
import { kraken } from '../../services/krakenService';
import KrakenOrderDetails from './KrakenOrderDetails';

export class KrakenWebhookOrder {
  requestBody: TradingViewBody;
  tradingViewTicker: string;
  krakenTicker: string;
  order?: KrakenOrderDetails;

  constructor(requestBody: TradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
    // Kraken uses XBT instead of BTC. Uniswap uses WETH instead of ETH
    // I use binance/uniswap for most webhooks since there is more volume
    this.krakenTicker = this.tradingViewTicker
      .replace('BTC', 'XBT')
      .replace('WETH', 'ETH')
      .replace('DOGE', 'XDG')
      .replace('USDT', 'USD');
  }

  async placeOrder() {
    // get pair data
    const { error: pairError, pair } = await kraken.getPair(this.krakenTicker);
    if (pairError?.length > 0) {
      console.log(`Pair data for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult({
        error: [`Pair data for ${this.krakenTicker} not available on Kraken`],
      });
    }

    // get pair price info for order
    const { error: priceError, price } = await kraken.getPrice(this.krakenTicker);
    if (priceError?.length > 0) {
      console.log(`Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult({
        error: [`Price info for ${this.krakenTicker} not available on Kraken`],
      });
    }

    // const { orderBookError, orderBookData } = await kraken.getOrderBook(this.krakenTicker);

    // btc or eth price for calculations (we're currently placing orders in fixed USD amount)
    const assetClass = this.krakenTicker.includes('XBT') ? 'XBTUSDT' : 'ETHUSDT';
    const { error: assetClassError, price: assetClassPrice } = await kraken.getPrice(assetClass);
    if (assetClassError?.length > 0) {
      console.log(`Asset Class Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult({
        error: [`Asset Class Price info for ${this.krakenTicker} not available on Kraken`],
      });
    }

    const { error: balanceError, balances } = await kraken.getBalance();
    if (balanceError?.length > 0) {
      console.log(`Could not find balance info for ${this.krakenTicker} on Kraken`);
      return new KrakenOrderResult({
        error: [`Could not find balance info for ${this.krakenTicker} on Kraken`],
      });
    }

    const { openOrders } = await kraken.getOpenOrders();

    // TODO: krakenize this
    const { result: tradeBalance } = await kraken.kraken.getTradeBalance();

    // set up the order
    this.order = new KrakenOrderDetails(
      this.requestBody,
      this.krakenTicker,
      pair,
      price,
      assetClassPrice,
      balances,
      openOrders,
      tradeBalance
    );

    // execute the order
    return await this.openOrder(this.order);
  }

  private async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    console.log(`Margin Free: ${order.marginFree}`);
    console.log(`Price: ${order.tradingViewPrice} | Bid: ${order.bidPrice}`);

    let result;
    if (order.oldest) {
      result = await kraken.sellOldestOrders(order, order.krakenTicker);
    } else if (order.bagIt) {
      result = await kraken.handleBags(order);
    } else if (order.noLeverage) {
      result = await kraken.handleNonLeveragedOrder(order);
    } else {
      if (order.close) {
        result = await kraken.settleLeveragedOrder(order);
      } else {
        result = await kraken.handleLeveragedOrder(order);
      }
    }

    return result;
  }
}
