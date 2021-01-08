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

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    // some orders might not have filled. cancel beforehand
    await this.cancelOpenOrdersForPair(order);

    let result;
    if (order.noLeverage) {
      result = await this.handleNonLeveragedOrder(order);
    } else if (order.bagIt) {
      result = await this.handleBags(order);
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
          const volumeToClose = parseFloat(position.vol) - parseFloat(position.vol_closed);
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
      console.log('Leveraged Order: Nothing to close');
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
          positionMargin += parseFloat(position.margin);
          totalPosition += parseFloat(position.cost);
          // console.log(
          //   `Adding ${order.krakenizedTradingViewTicker}, My Margin: ${positionMargin}, Total Position: ${totalPosition}`
          // );
        } else if (order.krakenTicker === position.pair && order.action !== position.type) {
          console.log("Opposite Order, Should've Closed?", order.krakenizedTradingViewTicker);
          await this.settleLeveragedOrder(order);
        }
      }

      if (add) {
        console.log(`Current Margin: ${positionMargin.toFixed(2)}`);
        console.log(`Margin After: ${(positionMargin + order.addSize).toFixed(2)}`);
        console.log(`Total Allowed: ${order.maxVolumeInDollar}`);
        const tooMuch = order.entrySize
          ? positionMargin >= order.maxVolumeInDollar
          : positionMargin >= 175;

        if (!tooMuch) {
          console.log(
            `Adding ${
              parseInt(
                ((Math.floor(positionMargin) - order.entrySize) / order.addSize).toFixed(0)
              ) + 1
            }/${order.addCount}: ${order.addSize}`
          );
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
          console.log('Easy there buddy');
        }
      } else if (!add) {
        console.log(`New Entry: ${order.tradeVolumeInDollar} @ ${order.leverageAmount}:1 leverage`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          leverage: order.leverageAmount,
          // validate: true,
        });
      }

      logOrderResult(`Leveraged Order`, result, order.krakenizedTradingViewTicker);
    }

    return result;
  }

  async handleNonLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let result;
    if (order.action === 'sell') {
      if (isNaN(order.balanceOfBase) || order.balanceOfBase < 1e-5) {
        result = new KrakenOrderResult({
          error: [`${order.action.toUpperCase()} balance is too small`],
        });
      } else {
        console.log(order.sellBags ? `Selling Bags` : `Selling ${order.balanceInDollar}`);
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
      if (order.balanceInDollar < order.maxVolumeInDollar || order.buyBags) {
        if (order.balanceOfBase < 1e-5) {
          console.log(`New Entry: ${order.tradeVolumeInDollar}`);
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.tradeVolume,
            // validate: true,
          });
        } else {
          console.log(`Current Balance: ${order.balanceInDollar.toFixed(2)}`);
          console.log(`Balance After: ${(order.balanceInDollar + order.addSize).toFixed(2)}`);
          console.log(`Total Allowed: ${order.maxVolumeInDollar}`);
          console.log(
            order.buyBags
              ? 'Buying Bags'
              : `Adding ${
                  parseInt(
                    ((Math.floor(order.balanceInDollar) - order.entrySize) / order.addSize).toFixed(
                      0
                    )
                  ) + 1
                }/${order.noLeverage ? order.addCount - 4 : order.addCount}: ${order.addSize}`
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
          `Position size for ${order.krakenizedTradingViewTicker} is too large ${order.balanceInDollar}`
        );
      }
    }

    logOrderResult(`Non Leveraged Order`, result, order.krakenizedTradingViewTicker);
    return result;
  }

  async handleBags(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    let closingVolume;
    let result;

    if (!order.localOnly) {
      result = await this.handleLeveragedOrder(order);
      logOrderResult(`Leveraged Order`, result, order.krakenizedTradingViewTicker);
    }

    if (order.buyBags) {
      // buy 40% worth of my usd available
      // currently morphing original order. Sorry immutability
      const buyVolumeInDollar = order.superParseFloat(
        order.balanceOfQuote * 0.4,
        order.volumeDecimals
      );
      let volumeBoughtInDollar = 0;
      let i = 1;

      while (volumeBoughtInDollar < buyVolumeInDollar) {
        order.tradeVolume =
          order.marginFree < buyVolumeInDollar
            ? order.superParseFloat(
                (order.marginFree * 0.98) / order.usdValueOfBase,
                order.volumeDecimals
              )
            : buyVolumeInDollar / order.usdValueOfBase;
        volumeBoughtInDollar += order.tradeVolume * order.usdValueOfBase;
        if (order.tradeVolume < order.minVolume) break;
        if (i > 8) {
          console.log(`Something went wrong buying bags, canceling`);
          volumeBoughtInDollar = buyVolumeInDollar;
        }

        // no way of knowing when the leveraged order is filled, so we'll wait
        setTimeout(async () => {
          result = await this.handleNonLeveragedOrder(order);
          logOrderResult(`Bagged Result`, result, order.krakenizedTradingViewTicker);
          console.log('-'.repeat(20));

          // if (result.error.length === 0) {
          //   const orderResult = result.result?.descr.order;
          //   if (!orderResult) return;

          //   const match = orderResult.match(/(\d+\.+\d+)\s/);
          //   const filled = match ? match[0].trim() : 0;

          //   volumeBoughtInDollar += order.superParseFloat(filled, order.volumeDecimals) || 0;
          // }
        }, 1000 * i++);
      }
    } else if (order.sellBags) {
      // sell 75% worth of currency available
      order.tradeVolume = order.superParseFloat(order.balanceOfBase * 0.75, order.volumeDecimals);

      // get right to it, we don't care about margin free
      result = await this.handleNonLeveragedOrder(order);
    } else {
      console.log('Idk how we got here');
    }

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
