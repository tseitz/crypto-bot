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
        console.log(`Canceling ${type} order`);
        result = await this.kraken.setCancelOrder({ txid: key });
      }
    }

    return result;
  }

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    // some orders might not have filled. cancel beforehand
    await this.cancelOpenOrdersForPair(order);

    let result;
    if (order.noLeverage) {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  async settleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    const { openPositions } = await this.getOpenPositions();

    // cancel open add order for this run. Some might not have been picked up
    await this.cancelOpenOrdersForPair(order);

    let latestResult;
    if (order.txId) {
      // close out specific transaction only (at least the value of it since we can't specify closing by id)
      // we do not break the for loop after close because there may be 2 or more orders filled in a transaction
      for (const key in openPositions) {
        const position = openPositions[key];
        if (position.pair === order.krakenTicker && position.ordertxid === order.txId) {
          const closeAction = position.type === 'sell' ? 'buy' : 'sell';
          const volumeToClose =
            Number.parseFloat(position.vol) - Number.parseFloat(position.vol_closed);
          latestResult = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: closeAction,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: volumeToClose,
            leverage: order.leverageAmount,
            // validate: true,
          });
          logOrderResult(`Settled Position`, latestResult, order.krakenizedTradingViewTicker);
        }
      }
    } else {
      for (const key in openPositions) {
        const position = openPositions[key];
        if (position.pair === order.krakenTicker && order.action !== position.type) {
          const closeAction = position.type === 'sell' ? 'buy' : 'sell';
          latestResult = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: closeAction,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: 0, // 0 for close all
            leverage: order.leverageAmount,
            // validate: true,
          });
          logOrderResult(`Settled Position`, latestResult, order.krakenizedTradingViewTicker);
          break;
        }
      }
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
      // TODO: use balanceOfBase?
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
          await this.settleLeveragedOrder(order);
        }
      }

      if (add) {
        console.log(`Total Allowable: ${order.entrySize + order.addSize * 4}`);
        console.log(`Adding: ${order.addSize}`);
        console.log(`Margin After Trade: ${positionMargin + order.addSize}`);
        const tooMuch = order.entrySize
          ? positionMargin >= order.entrySize + order.addSize * 4
          : positionMargin >= 175;

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
        console.log(`New Entry: ${order.tradeVolumeInDollar}`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          leverage: order.leverageAmount,
        });
      }

      logOrderResult(`Leveraged Order Complete`, result, order.krakenizedTradingViewTicker);
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
        console.log(order.sellBags ? `Selling Bags` : `Selling ${order.tradingViewTicker}`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          // validate: true,
        });
      }
    } else {
      if (
        order.usdValueOfBase * order.balanceOfBase < order.entrySize + order.addSize * 4 ||
        order.buyBags
      ) {
        if (order.balanceOfBase < 1e-5) {
          console.log('New Entry');
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.tradeVolume,
            // validate: true,
          });
        } else {
          console.log(`Total Allowable: ${order.entrySize + order.addSize * 4}`);
          console.log(order.buyBags ? 'Buying Bags' : `Adding: ${order.addSize}`);
          console.log(
            `Balance After Trade: ${order.usdValueOfBase * order.balanceOfBase + order.addSize}`
          );
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.buyBags ? order.tradeVolume : order.addVolume,
            // validate: true,
          });
        }
      } else {
        console.log(
          `Position size for ${order.krakenizedTradingViewTicker} is too large ${
            order.usdValueOfBase * order.balanceOfBase
          }`
        );
      }
    }

    logOrderResult(`Non Leveraged Order Complete`, result, order.krakenizedTradingViewTicker);
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
