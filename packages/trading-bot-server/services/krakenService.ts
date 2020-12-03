const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
import KrakenOrderDetails from '../models/kraken/KrakenOrderDetails';
import { logOrderResult } from './logger';
import {
  KrakenPriceResult,
  KrakenTradeablePairResult,
  KrakenBalanceResult,
  KrakenOpenPositionResult,
  KrakenOpenOrderResult,
  KrakenOrderResult,
  KrakenOrderResponse,
} from '../models/kraken/KrakenResults';

class KrakenService {
  kraken: any; // krakenApi

  constructor(kraken: any) {
    this.kraken = kraken;
  }

  async getPair(krakenTicker: string): Promise<KrakenTradeablePairResult> {
    return new KrakenTradeablePairResult(
      await this.kraken.getTradableAssetPairs({
        pair: krakenTicker,
      })
    );
  }

  async getPrice(krakenTicker: string): Promise<KrakenPriceResult> {
    return new KrakenPriceResult(
      await this.kraken.getTickerInformation({
        pair: krakenTicker,
      })
    );
  }

  async getBalance(): Promise<KrakenBalanceResult> {
    return new KrakenBalanceResult(await this.kraken.getBalance());
  }

  async getOpenOrders(): Promise<KrakenOpenOrderResult> {
    return new KrakenOpenOrderResult(await this.kraken.getOpenOrders());
  }

  async getOpenPositions(): Promise<KrakenOpenPositionResult> {
    return new KrakenOpenPositionResult(await this.kraken.getOpenPositions());
  }

  async getOrderBook(pair: string) {
    const { error: orderBookError, openPositions: orderBookData } = await this.kraken.getOrderBook({
      pair,
    });

    return { orderBookError, orderBookData };
  }

  // async setAddOrder() {}

  async cancelOppositeOpenOrdersForPair(order: KrakenOrderDetails) {
    const open = order.openOrders['open'];

    let result;
    for (const key in open) {
      const pair = open[key]['descr']['pair'];
      const type = open[key]['descr']['type'];

      if (pair === order.krakenizedTradingViewTicker && type === order.oppositeAction) {
        console.log(`Canceling ${pair} ${type}`);
        result = await this.kraken.setCancelOrder({ txid: key });
      }
    }

    return result;
  }

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    // some orders might not have filled. cancel beforehand
    await this.cancelOppositeOpenOrdersForPair(order);

    let result;
    if (typeof order.leverageAmount === 'undefined') {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  async settleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    const { openPositions } = await this.getOpenPositions();

    // close out positons first
    let latestResult;
    for (const key in openPositions) {
      const position = openPositions[key];
      if (position.pair === order.krakenTicker) {
        // const closeAction = position.type === 'sell' ? 'buy' : 'sell';
        // const volumeToClose =
        //   Number.parseFloat(position.vol) - Number.parseFloat(position.vol_closed);
        latestResult = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: position.type,
          ordertype: 'settle-position',
          price: position.type === 'sell' ? order.currentBid : order.currentAsk,
          volume: 0, // 0 for close all
          leverage: order.leverageAmount,
          validate: true,
        });
        logOrderResult(`${order.krakenTicker} Settled Position`, latestResult);
        break;
      }
    }

    return latestResult;
  }

  async handleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let result;
    if (order.close) {
      result = await this.settleLeveragedOrder(order);
    } else {
      let { openPositions } = await this.getOpenPositions();

      let add = false;
      let count = 0;
      for (const key in openPositions) {
        const position = openPositions[key];
        if (order.krakenTicker === position.pair && order.action === position.type) {
          add = true;
          count++;
          console.log('Position Already Open, Adding', order.krakenTicker, count);
        } else if (order.krakenTicker === position.pair && order.action !== position.type) {
          console.log("Opposite Order, Should've Closed?", order.krakenTicker);
          // await this.settleLeveragedOrder(order);
        }
      }

      if (add && count < 4) {
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          // ordertype: 'market',
          price: order.bidPrice,
          volume: order.addVolume,
          leverage: order.leverageAmount,
          // validate: true,
        });
      } else {
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          // ordertype: 'market',
          price: order.bidPrice,
          volume: order.tradeVolume,
          leverage: order.leverageAmount,
          // validate: true,
        });
      }

      logOrderResult(`${order.krakenTicker} Leveraged Order Complete`, result);
    }

    return result;
  }

  async handleNonLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let result;
    if (order.action === 'sell') {
      if (isNaN(order.balanceOfBase) || order.balanceOfBase < 1e-6) {
        result = new KrakenOrderResult({
          error: [
            `${order.krakenTicker} ${order.action.toUpperCase()} balance is too small to sell`,
          ],
        });
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
      if (order.balanceOfBase < 380) {
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          // validate: true,
        });
      } else {
        console.log(
          `Position size for ${order.krakenizedTradingViewTicker} is too large ${order.balanceOfBase}`
        );
      }
    }

    logOrderResult(`${order.krakenTicker} Non Leveraged Order Complete`, result);
    return result;
  }

  async balancePortfolio() {
    const { balances } = await this.getBalance();
    console.log('USD Balance Before Rebalance:', balances['ZUSD']);

    const { openPositions } = await this.getOpenPositions();

    let longEthBtc, longBtcUsd, longEthUsd;
    for (const key in openPositions) {
      const pair = openPositions[key]['pair'];
      const type = openPositions[key]['type'];

      if (pair === 'XETHXXBT') {
        longEthBtc = type === 'buy';
      } else if (pair === 'XXBTZUSD') {
        longBtcUsd = type === 'buy';
      } else if (pair === 'XETHZUSD') {
        longEthUsd = type === 'buy';
      }
    }

    // if (longEthBtc && longBtcUsd) {

    // } else if () {

    // }

    console.log(longEthBtc, longBtcUsd, longEthUsd);

    return balances;
  }
}

const krakenApi = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);
export const kraken = new KrakenService(krakenApi);