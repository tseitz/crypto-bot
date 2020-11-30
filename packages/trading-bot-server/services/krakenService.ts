const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
import KrakenOrderDetails from '../models/kraken/KrakenOrderDetails';
import {
  KrakenPriceResult,
  KrakenTradeablePairResult,
  KrakenBalanceResult,
} from '../models/kraken/KrakenResults';
import { KrakenOpenPosition } from '../models/kraken/KrakenResults';
import { KrakenOrderResponse } from '../models/kraken/KrakenOrderResponse';

class KrakenService {
  kraken: any; // krakenApi

  constructor(kraken: any) {
    this.kraken = kraken;
  }

  async getPair(krakenTicker: string) {
    const {
      error: pairError,
      result: pairData,
    }: KrakenTradeablePairResult = await this.kraken.getTradableAssetPairs({
      pair: krakenTicker,
    });

    return { pairError, pairData };
  }

  async getPrice(krakenTicker: string) {
    const {
      error: priceError,
      result: priceData,
    }: KrakenPriceResult = await this.kraken.getTickerInformation({
      pair: krakenTicker,
    });

    return { priceError, priceData };
  }

  async getBalance() {
    const {
      error: balanceError,
      result: balanceData,
    }: KrakenBalanceResult = await this.kraken.getBalance();

    return { balanceError, balanceData };
  }

  async getOpenOrders() {
    const {
      error: openOrderError,
      result: openOrderData,
    }: KrakenBalanceResult = await this.kraken.getOpenOrders();

    return { openOrderError, openOrderData };
  }

  async cancelOpenOrdersForPair(order: KrakenOrderDetails) {
    const open = order.openOrders['open'];

    let result;
    for (const key in open) {
      if (open[key]['descr']['pair'] === order.krakenizedTradingViewTicker) {
        console.log(key);
        result = await this.kraken.setCancelOrder({ txid: key });
      }
    }

    return result;
  }

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    // some orders might not have filled. cancel beforehand
    await this.cancelOpenOrdersForPair(order);

    let result;
    if (typeof order.leverageAmount === 'undefined') {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  async settleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    const {
      error: openPositionError,
      result: openPositions,
    } = await this.kraken.getOpenPositions();

    // close out positons first
    let latestResult;
    for (const key in openPositions) {
      const position: KrakenOpenPosition = openPositions[key];
      if (position.pair === order.krakenTicker) {
        const closeAction = position.type === 'sell' ? 'buy' : 'sell';
        const volumeToClose =
          Number.parseFloat(position.vol) - Number.parseFloat(position.vol_closed);
        console.log('Volume to Close: ', volumeToClose);
        latestResult = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: closeAction,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: 0, // 0 for close all
          leverage: order.leverageAmount,
          // validate: true,
        });
        console.log(`${order.krakenTicker} Settled Position: `, latestResult);
      }
    }

    return latestResult;
  }

  async handleLeveragedOrder(
    order: KrakenOrderDetails,
    closeOpenPositions = true,
    onlyCloseOpenPositions = false
  ): Promise<KrakenOrderResponse> {
    // TODO: pass this along in the request body. Sometimes we don't want to close positions first
    if (closeOpenPositions) {
      const result = await this.settleLeveragedOrder(order);

      if (onlyCloseOpenPositions) return result;
    }

    const result = await this.kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'limit',
      price: order.bidPrice,
      volume: order.tradeVolume,
      leverage: order.leverageAmount,
      // validate: true,
    });

    console.log(`${order.krakenTicker} Leveraged Order Complete: `, result);
    return result;
  }

  async handleNonLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let result;
    if (order.action === 'sell') {
      if (isNaN(order.balanceOfBase) || order.balanceOfBase < 1e-6) {
        result = new KrakenOrderResponse(
          `${order.krakenTicker} ${order.action.toUpperCase()} balance is too small to sell`
        );
      } else {
        // sell off current balance, we cannot short so stop there
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          volume: order.balanceOfBase,
          price: order.bidPrice,
          // validate: true,
        });
      }
    } else {
      result = await this.kraken.setAddOrder({
        pair: order.krakenTicker,
        type: order.action,
        ordertype: 'limit',
        price: order.bidPrice,
        volume: order.tradeVolume,
        // validate: true,
      });
    }

    console.log(`${order.krakenTicker} Non Leveraged Order Complete: `, result);
    return result;
  }

  async balancePortfolio() {}
}

const krakenApi = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);
export const kraken = new KrakenService(krakenApi);
