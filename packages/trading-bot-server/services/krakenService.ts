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

  async cancelOpenOrdersForPair(order: KrakenOrderDetails, opposite = true) {
    const open = order.openOrders['open'];

    let result;
    for (const key in open) {
      const pair = open[key]['descr']['pair'];
      const type = open[key]['descr']['type'];
      const action = opposite ? order.oppositeAction : order.action;

      if (pair === order.krakenizedTradingViewTicker && type === action) {
        console.log(`${pair} ${order.action} Canceling ${type}`);
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
    const { openPositions } = await this.getOpenPositions();

    // cancel open add order for this run. Some might not have been picked up
    await this.cancelOpenOrdersForPair(order, false);

    // close out positons first
    let latestResult;
    for (const key in openPositions) {
      const position = openPositions[key];
      if (position.pair === order.krakenTicker) {
        const closeAction = position.type === 'sell' ? 'buy' : 'sell';
        // const volumeToClose =
        //   Number.parseFloat(position.vol) - Number.parseFloat(position.vol_closed);
        latestResult = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: closeAction,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: 0, // 0 for close all
          leverage: order.leverageAmount,
          // validate: true,
        });
        logOrderResult(
          `${order.krakenizedTradingViewTicker} Settled Position`,
          latestResult,
          order.krakenizedTradingViewTicker
        );
        break;
      }
      // if (position.pair === order.krakenTicker) {
      //   // const closeAction = position.type === 'sell' ? 'buy' : 'sell';
      //   // const volumeToClose =
      //   //   Number.parseFloat(position.vol) - Number.parseFloat(position.vol_closed);
      //   latestResult = await this.kraken.setAddOrder({
      //     pair: order.krakenTicker,
      //     type: position.type,
      //     ordertype: 'settle-position',
      //     price: position.type === 'sell' ? order.currentBid : order.currentAsk,
      //     volume: position.vol, // 0 for close all
      //     leverage: order.leverageAmount,
      //     // validate: true,
      //   });
      //   logOrderResult(`${order.krakenizedTradingViewTicker} Settled Position`, latestResult);
      //   // break;
      // }
    }

    if (!latestResult) {
      console.log('Nothing to close');
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
      let positionMargin = 0,
        totalPosition = 0;
      for (const key in openPositions) {
        const position = openPositions[key];
        if (order.krakenTicker === position.pair && order.action === position.type) {
          add = true;
          positionMargin += Number.parseFloat(position.margin);
          totalPosition += Number.parseFloat(position.cost);
          // console.log(
          //   `Adding ${order.krakenizedTradingViewTicker}, My Margin: ${positionMargin}, Total Position: ${totalPosition}`
          // );
        } else if (order.krakenTicker === position.pair && order.action !== position.type) {
          console.log("Opposite Order, Should've Closed?", order.krakenizedTradingViewTicker);
          // await this.settleLeveragedOrder(order);
        }
      }

      if (add) {
        console.log('Adding... Margin After Trade: ', positionMargin + order.addSize);
        console.log('Total Allowable: ', order.entrySize + order.addSize * 3);
        const tooMuch = order.entrySize
          ? positionMargin > order.entrySize + order.addSize * 3
          : positionMargin > 175;

        if (!tooMuch) {
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
          console.log('Too much power!!');
        }
      } else if (!add) {
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

      logOrderResult(
        `${order.krakenizedTradingViewTicker} Leveraged Order Complete`,
        result.order.krakenizedTradingViewTicker
      );
    }

    return result;
  }

  async handleNonLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let result;
    if (order.action === 'sell') {
      if (isNaN(order.balanceOfBase) || order.balanceOfBase < 1e-6) {
        result = new KrakenOrderResult({
          error: [
            `${
              order.krakenizedTradingViewTicker
            } ${order.action.toUpperCase()} balance is too small`,
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
      if (order.balanceOfBase < 250) {
        if (order.balanceOfBase < 1e-5) {
          console.log('New Non Leveraged Entry');
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.tradeVolume,
            // validate: true,
          });
        } else {
          console.log('Adding to Non Leverage');
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.addVolume,
            // validate: true,
          });
        }
      } else {
        console.log(
          `Position size for ${order.krakenizedTradingViewTicker} is too large ${order.balanceOfBase}`
        );
      }
    }

    logOrderResult(
      `${order.krakenizedTradingViewTicker} Non Leveraged Order Complete`,
      result,
      order.krakenizedTradingViewTicker
    );
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
