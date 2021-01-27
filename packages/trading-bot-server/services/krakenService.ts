const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
// import { mongoClient, logKrakenResult } from './mongoDbService';
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
  KrakenOpenPositions,
  KrakenOpenPosition,
} from '../models/kraken/KrakenResults';
import { sleep, superParseFloat } from '../scripts/common';

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

  async cancelOpenOrdersForPair(order: KrakenOrderDetails, opposite = true) {
    const open = order.openOrders?.open;

    if (!open) return;

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

    // if closing order, make sure there are no leftovers sells as well
    // this occurs when we sell oldest order, and it does not fill
    // this resulted in a short position that lost 15% -_- never again
    // if (order.close) {
    //   await this.cancelOpenOrdersForPair(order, false);
    // }

    return result;
  }

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    // some orders might not have filled. cancel beforehand
    // await this.cancelOpenOrdersForPair(order);

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
    let latestResult;

    // cancel open add order for this group. Some might not have been picked up
    await this.cancelOpenOrdersForPair(order);

    const { openPositions } = await this.getOpenPositions();
    if (order.txId) {
      // close out specific transaction only (at least the value of it since we can't specify closing by id)
      // we don't break the for loop because there may be 2 or more orders filled in a transaction
      for (const key in openPositions) {
        const position = openPositions[key];
        if (position.pair === order.krakenTicker && position.ordertxid === order.txId) {
          latestResult = await this.settleTxId(position, order);
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
            // validate: order.validate,
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
      let positionMargin = 0;
      let totalPosition = 0;
      for (const key in openPositions) {
        const position = openPositions[key];
        if (order.krakenTicker === position.pair && order.action === position.type) {
          add = true;
          positionMargin += parseFloat(position.margin);
          totalPosition += parseFloat(position.cost);
        } else if (order.krakenTicker === position.pair && order.action !== position.type) {
          console.log("Opposite Order, Should've Closed?", order.krakenizedTradingViewTicker);
          await this.settleLeveragedOrder(order);
        }
      }

      if (order.marginFree < 170) {
        console.log('Margin Level too Low. Selling oldest order.');
        await this.sellOldestOrder(order, openPositions);
        await sleep(2000);
      }

      if (add) {
        const addCount =
          parseInt(((Math.floor(positionMargin) - order.entrySize) / order.addSize).toFixed(0)) + 1;
        const incrementalAddVolume = (order.addVolume * (1 + addCount * order.addBoost)).toFixed(
          order.volumeDecimals
        );
        const incrementalAddDollar = (
          (order.positionSize || order.addSize) *
          (1 + addCount * order.addBoost)
        ).toFixed(2);
        console.log(`Adding ${addCount}/${order.addCount}`);
        console.log(`Original: ${order.addSize}, Incremental: ${incrementalAddDollar}`);
        console.log(
          `Margin After: ${(positionMargin + parseFloat(incrementalAddDollar)).toFixed(2)}`
        );
        console.log(
          `Position Size After: ${(
            totalPosition +
            parseFloat(incrementalAddDollar) * (order.leverageAmount || 1)
          ).toFixed(2)}`
        );

        if (addCount > order.addCount) {
          console.log('Selling Oldest Position First');
          await this.sellOldestOrder(order, openPositions, true);
          await sleep(2000);
        }

        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: incrementalAddVolume,
          leverage: order.leverageAmount,
          // validate: order.validate,
        });
      } else if (!add) {
        console.log(`New Entry: ${order.entrySize}`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          leverage: order.leverageAmount,
          // validate: order.validate,
        });
      }

      if (result) {
        logOrderResult(`Leveraged Order`, result, order.krakenizedTradingViewTicker);
      }
    }

    return result;
  }

  async handleNonLeveragedOrder(
    order: KrakenOrderDetails
  ): Promise<KrakenOrderResponse | undefined> {
    let result;
    if (order.action === 'sell') {
      if (order.balanceInDollar === 0) {
        result = new KrakenOrderResult({
          error: [`${order.action.toUpperCase()} balance is too small`],
        });
      } else {
        console.log(order.sellBags ? `Selling Bags` : `Selling ${order.tradeVolumeInDollar}`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          // validate: order.validate,
        });
      }
    } else {
      if (order.balanceInDollar === 0 && order.marginFree > 170) {
        console.log(`New Entry: ${order.tradeVolumeInDollar}`);
        result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: order.action,
          ordertype: 'limit',
          price: order.bidPrice,
          volume: order.tradeVolume,
          // validate: order.validate,
        });
      } else {
        const addCount =
          parseInt(
            ((Math.floor(order.balanceInDollar) - order.entrySize) / order.addSize).toFixed(0)
          ) + 1;
        const incrementalAddVolume = (order.addVolume * (1 + addCount * order.addBoost)).toFixed(
          order.volumeDecimals
        );
        const incrementalAddDollar = (
          (order.positionSize || order.addSize) *
          (1 + addCount * order.addBoost)
        ).toFixed(2);

        if (!order.buyBags) {
          console.log(`Adding ${addCount}/${order.addCount}`);
          console.log(`Original: ${order.addSize}, Incremental: ${incrementalAddDollar}`);
          console.log(`Balance After: ${(order.balanceInDollar + order.addSize).toFixed(2)}`);
        } else {
          console.log('Buying Bags');
          console.log(
            `Balance After: ${(order.balanceInDollar + order.tradeVolumeInDollar).toFixed(2)}`
          );
        }

        if ((!order.buyBags && addCount > order.addCount) || order.marginFree < 125) {
          console.log('Selling Some First');

          const newOrder = { ...order };
          newOrder.action = 'sell';
          newOrder.bidPrice = order.currentBid; // just give it to bid for now // order.getBid(); get new bid for sell
          if (order.addVolume !== parseFloat(incrementalAddVolume)) {
            result = await this.kraken.setAddOrder({
              pair: newOrder.krakenTicker,
              type: newOrder.action,
              ordertype: 'limit',
              price: newOrder.bidPrice,
              volume: order.addVolume,
              // validate: order.validate,
            });
            await sleep(2000);
            logOrderResult(`Sell Non Leveraged Order`, result, order.krakenizedTradingViewTicker);

            result = await this.kraken.setAddOrder({
              pair: order.krakenTicker,
              type: order.action,
              ordertype: 'limit',
              price: order.bidPrice,
              volume: order.buyBags ? order.tradeVolume : incrementalAddVolume,
              // validate: order.validate,
            });
          } else {
            console.log('Order size is the same. No action needed');
          }
        }
      }
    }

    if (result) {
      logOrderResult(`Non Leveraged Order`, result, order.krakenizedTradingViewTicker);
    }

    // await logKrakenResult(order, result);
    return result;
  }

  async handleBags(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    let tradeVolumeInDollar, result;

    // local meaning don't close leverage orders
    if (!order.nonLeverageOnly) {
      result = await this.handleLeveragedOrder(order);
      logOrderResult(`Leveraged Order`, result, order.krakenizedTradingViewTicker);
    }

    if (order.buyBags) {
      // buy 40% worth of my usd available
      // currently morphing original order. Sorry immutability
      const bagAmount = order.bagAmount ? order.bagAmount : 0.4;
      tradeVolumeInDollar = superParseFloat(order.balanceOfQuote * bagAmount, order.volumeDecimals);
    } else {
      // sell 80% worth of currency available
      const bagAmount = order.bagAmount ? order.bagAmount : 0.75;
      tradeVolumeInDollar = superParseFloat(
        order.balanceOfBase * order.usdValueOfBase * bagAmount,
        order.volumeDecimals
      );
    }

    let volumeTradedInDollar = 0;
    let i = 0;
    while (volumeTradedInDollar < tradeVolumeInDollar) {
      order.tradeVolume =
        order.marginFree < tradeVolumeInDollar
          ? superParseFloat((order.marginFree * 0.8) / order.usdValueOfBase, order.volumeDecimals)
          : tradeVolumeInDollar / order.usdValueOfBase;
      volumeTradedInDollar += order.tradeVolume * order.usdValueOfBase;
      if (order.tradeVolume < order.minVolume) break;
      if (i > 8) {
        console.log(`Something went wrong buying bags, canceling`);
        volumeTradedInDollar = tradeVolumeInDollar;
      }

      // no way of knowing when the leveraged order is filled, so we'll wait
      setTimeout(async () => {
        // update bid price
        const { price } = await kraken.getPrice(order.krakenTicker);
        const currentBid = superParseFloat(price[order.krakenTicker]['b'][0], order.priceDecimals);
        const currentAsk = superParseFloat(price[order.krakenTicker]['a'][0], order.priceDecimals);
        order.bidPrice = order.action === 'buy' ? currentAsk : currentBid;

        // order
        result = await this.handleNonLeveragedOrder(order);
        console.log('-'.repeat(20));
      }, 20000 * i);
      i++;
    }
    return result;
  }

  async settleTxId(position: KrakenOpenPosition, order: KrakenOrderDetails, immediate?: boolean) {
    const closeAction = position.type === 'sell' ? 'buy' : 'sell';
    const volumeToClose = parseFloat(position.vol) - parseFloat(position.vol_closed);
    let bidPrice = order.bidPrice;
    let leverageAmount = order.leverageAmount;

    // if tx is not this pair, get data for it. used mostly in settle oldest transaction
    if (position.pair !== order.krakenTicker) {
      const { price } = await kraken.getPrice(position.pair);
      const { pair } = await kraken.getPair(position.pair);

      const currentBid = price[position.pair]['b'][0];
      const currentAsk = price[position.pair]['a'][0];
      const leverageBuyAmounts = pair[position.pair]['leverage_buy'];
      const leverageSellAmounts = pair[position.pair]['leverage_sell'];

      // TODO: Get bid from class
      if (!immediate) {
        bidPrice = position.type === 'buy' ? parseFloat(currentAsk) : parseFloat(currentBid);
      } else {
        bidPrice = parseFloat(currentBid);
        console.log(`Selling straight to bid. Current Bid: ${currentBid}`);
      }
      leverageAmount =
        position.type === 'buy'
          ? leverageBuyAmounts[leverageBuyAmounts.length - 1]
          : leverageSellAmounts[leverageSellAmounts.length - 1];
    }

    let result = await this.kraken.setAddOrder({
      pair: position.pair,
      type: closeAction,
      ordertype: 'limit',
      price: bidPrice,
      volume: volumeToClose,
      leverage: leverageAmount,
      // validate: order.validate,
    });
    if (result.error.length) {
      console.log('Could not sell oldest. Selling oldest of pair. Please fix');
      result = await this.sellOldestOrder(order, undefined, true);
    }
    logOrderResult(`Settled Position`, result, position.pair);

    return result;
  }

  async sellOldestOrder(
    order: KrakenOrderDetails,
    openPositions?: KrakenOpenPositions,
    pairOnly?: boolean
  ) {
    if (!openPositions) {
      const positionResult = await this.getOpenPositions();
      openPositions = positionResult.openPositions;
    }

    let positionToClose;
    for (const key in openPositions) {
      const position = openPositions[key];
      if (order.action === position.type && (!pairOnly || order.krakenTicker === position.pair)) {
        positionToClose =
          positionToClose && position.time > positionToClose.time ? positionToClose : position;
      }
    }

    if (positionToClose) {
      await this.settleTxId(positionToClose, order, true);
    }
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
