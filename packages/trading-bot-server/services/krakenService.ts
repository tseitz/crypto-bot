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
  KrakenOpenPosition,
  KrakenOpenPositions,
  KrakenTradeBalanceResult,
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

  async getTradeBalance(): Promise<KrakenTradeBalanceResult> {
    return new KrakenTradeBalanceResult(await this.kraken.getTradeBalance());
  }

  async openOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    console.log(`Margin Free: ${order.marginFree}`);
    console.log(`Price: ${order.tradingViewPrice} | Bid: ${order.bidPrice}`);

    let result;
    if (order.oldest) {
      result = await this.sellOldestOrders(order, order.krakenTicker);
    } else if (order.bagIt) {
      result = await this.handleBags(order);
    } else if (order.noLeverage) {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  async handleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    let result;
    // await this.cancelOpenOrdersForPair(order, order.action);

    if (order.close) {
      result = await this.settleLeveragedOrder(order);
    } else {
      let { openPositions } = await this.getOpenPositions();

      let add = false;
      let positionMargin = 0;
      let prices: number[] = [];
      for (const key in openPositions) {
        const position = openPositions[key];
        if (order.krakenTicker === position.pair && order.action === position.type) {
          add = true;
          positionMargin += parseFloat(position.margin);
          prices.push(parseFloat(position.cost) / parseFloat(position.vol));
        } else if (order.krakenTicker === position.pair && order.action !== position.type) {
          console.log("Opposite Order, Should've Closed?", order.krakenizedTradingViewTicker);
          await this.settleLeveragedOrder(order);
        }
      }

      if (order.marginFree < order.lowestLeverageMargin) {
        console.log('Margin level too low, selling some.');
        const positionsBySize = await this.getOpenPositionsBySize(openPositions);
        result = await this.sellOldestOrders(
          order,
          positionsBySize.keys().next().value,
          openPositions
        );
      }

      if (add) {
        const addCount =
          parseInt(
            ((Math.floor(positionMargin) - order.entrySize) / order.originalAdd).toFixed(0)
          ) + 1;

        // get average price of positions
        let averagePrice = superParseFloat(
          prices.reduce((a, b) => a + b) / prices.length,
          order.priceDecimals
        );
        const percentDiff = parseFloat(
          (((order.bidPrice - averagePrice) / ((order.bidPrice + averagePrice) / 2)) * 100).toFixed(
            2
          )
        );

        // if ahead of average price (aka bid price > average), lower add value, otherwise, raise add value
        // this attempts to bring the average down when behind and add smaller when ahead
        const boostPercentDiff = percentDiff * -3.7;
        const boost = parseFloat((1 + boostPercentDiff / 100).toFixed(4));

        const incrementalAddVolume = (order.addVolume * boost).toFixed(order.volumeDecimals);
        const incrementalAddDollar = ((order.positionSize || order.addSize) * boost).toFixed(2);
        const myPositionAfter = (positionMargin + parseFloat(incrementalAddDollar)).toFixed(2);
        const marginPositionAfter = parseFloat(
          (parseFloat(myPositionAfter) * (order.leverageAmount || 1)).toFixed(2)
        );

        console.log(
          `Adding: ${addCount}/${order.addCount} | ${
            order.shortZone ? `Short Zone ${order.shortZoneDeleverage}` : 'Long Zone'
          }`
        );
        console.log(`Diff: ${averagePrice} | ${order.bidPrice} | ${percentDiff}%`);
        console.log(`Boost: ${order.addSize.toFixed(2)} | ${boost}x | ${incrementalAddDollar}`);
        console.log(`Position: ${myPositionAfter} | ${marginPositionAfter}`);

        // if it's within a certain percentage and already a decent position and margin is fairly low, skip it
        if (
          percentDiff < 1 &&
          percentDiff > -1 &&
          positionMargin > 750 &&
          order.marginFree < order.lowestLeverageMargin * 2
        ) {
          console.log('Position within 1%. Margin too low. Ignoring.');
          return result;
        }

        if (addCount > order.addCount) {
          console.log(`Too many adds, selling some first.`);
          await this.sellOldestOrders(
            order,
            order.krakenTicker,
            openPositions,
            addCount - order.addCount
          );
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
        logOrderResult(`ORDER`, result, order.krakenizedTradingViewTicker);
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
        console.log(order.sellBags ? `Selling Bags` : `Selling: ${order.tradeVolumeInDollar}`);
        console.log(`Balance After: ${order.tradeVolumeInDollar + order.marginFree}`);
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
      if (order.balanceInDollar === 0 && order.marginFree > order.lowestNonLeverageMargin) {
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
        // This is all just a guestimate since we're not sure if we boosted each time
        const addCount =
          parseInt(
            ((Math.floor(order.balanceInDollar) - order.entrySize) / order.originalAdd).toFixed(0)
          ) + 1;

        if (!order.buyBags) {
          console.log(
            `Adding: ${addCount}/${order.addCount} | ${
              order.shortZone ? `Short Zone ${order.shortZoneDeleverage}` : 'Long Zone'
            }`
          );
        } else {
          console.log('Buying Bags');
          console.log(
            `Balance After: ${(order.balanceInDollar + order.tradeVolumeInDollar).toFixed(2)}`
          );
        }

        // sell some if add count too high or margin too low
        if (
          !order.buyBags &&
          (addCount > order.addCount || order.marginFree < order.lowestNonLeverageMargin)
        ) {
          // cancel previous sell since we're bundling
          await this.cancelOpenOrdersForPair(order, 'sell');

          const newOrder = { ...order };
          const addDiff = addCount > order.addCount ? addCount - order.addCount : 1;

          newOrder.action = 'sell';
          newOrder.bidPrice = order.getBid(); // get new bid for sell order.currentBid; // just give it to bid for now
          const sellVolume = superParseFloat(newOrder.addVolume * addDiff, newOrder.volumeDecimals);
          const sellVolumeInDollar = order.convertBaseToDollar(sellVolume, order.usdValueOfBase);

          const sellDiff = order.tradeVolume - sellVolume;
          console.log(`Add: ${order.tradeVolume} | Sell: ${sellVolume} | ${sellDiff.toFixed(4)}`);
          console.log(sellDiff < 0 ? `Selling the difference` : `Buying the difference`);
          console.log(
            `Balance After: ${(
              order.balanceInDollar +
              order.tradeVolumeInDollar -
              sellVolumeInDollar
            ).toFixed(2)}`
          );
          if (sellDiff > 0) {
            const volume = sellDiff > order.minVolume ? sellDiff : order.minVolume;
            result = await this.kraken.setAddOrder({
              pair: order.krakenTicker,
              type: order.action,
              ordertype: 'limit',
              price: order.bidPrice,
              volume,
              // validate: order.validate,
            });
          } else {
            const volume =
              Math.abs(sellDiff) > order.minVolume ? Math.abs(sellDiff) : order.minVolume;
            result = await this.kraken.setAddOrder({
              pair: newOrder.krakenTicker,
              type: newOrder.action,
              ordertype: 'limit',
              price: newOrder.bidPrice,
              volume,
              // validate: order.validate,
            });
          }
        } else {
          console.log(
            `Balance After: ${(order.balanceInDollar + order.tradeVolumeInDollar).toFixed(2)}`
          );
          result = await this.kraken.setAddOrder({
            pair: order.krakenTicker,
            type: order.action,
            ordertype: 'limit',
            price: order.bidPrice,
            volume: order.tradeVolume,
            // validate: order.validate,
          });
        }
      }
    }

    if (result) {
      logOrderResult(`ORDER`, result, order.krakenizedTradingViewTicker);
    }

    // await logKrakenResult(order, result);
    return result;
  }

  async settleLeveragedOrder(order: KrakenOrderDetails): Promise<KrakenOrderResponse> {
    let latestResult;

    // cancel open add order for this group. Some might not have been picked up
    await this.cancelOpenOrdersForPair(order, order.action);
    await this.cancelOpenOrdersForPair(order, order.oppositeAction);

    const { openPositions } = await this.getOpenPositions();
    // cost * margin
    if (order.txId) {
      // close out specific transaction only (at least the value of it since we can't specify closing by id)
      // we don't break the for loop because there may be 2 or more orders filled in a transaction
      for (const key in openPositions) {
        const position = openPositions[key];
        if (position.pair === order.krakenTicker && position.ordertxid === order.txId) {
          latestResult = await this.settleTxId(position, order);
        }
      }
    } else if (order.closePositionSize) {
      // close out specific position size
      const positionsForPair: KrakenOpenPosition[] = [];
      for (const key in openPositions) {
        const position = openPositions[key];
        if (position.pair === order.krakenTicker) {
          positionsForPair.push(position);
        }
      }
      if (order.positionSize) {
        const count =
          order.positionSize >= 1
            ? order.positionSize
            : Math.floor(positionsForPair.length * order.positionSize);
        console.log(`Selling ${count} Positions for ${order.tradingViewTicker}`);
        latestResult = await this.sellOldestOrders(order, order.krakenTicker, openPositions, count);
      } else {
        console.log('No position size specified. Cancelling.');
      }
    } else {
      let positionMargin = 0;
      let prices: number[] = [];

      for (const key in openPositions) {
        const position = openPositions[key];
        if (order.krakenTicker === position.pair && order.oppositeAction === position.type) {
          positionMargin += parseFloat(position.margin);
          prices.push(parseFloat(position.cost) / parseFloat(position.vol));
        }
      }

      // get average price of positions
      let averagePrice = superParseFloat(
        prices.reduce((a, b) => a + b) / prices.length,
        order.priceDecimals
      );
      const percentDiff = parseFloat(
        (((order.bidPrice - averagePrice) / ((order.bidPrice + averagePrice) / 2)) * 100).toFixed(2)
      );

      const myPositionAfter = positionMargin.toFixed(2);
      const marginPositionAfter = parseFloat(
        (parseFloat(positionMargin.toFixed(2)) * (order.leverageAmount || 1)).toFixed(2)
      );
      console.log(`Diff: ${averagePrice} | ${order.bidPrice} | ${percentDiff}%`);
      console.log(`Position: ${myPositionAfter} | ${marginPositionAfter}`);

      latestResult = await this.kraken.setAddOrder({
        pair: order.krakenTicker,
        type: order.action,
        ordertype: 'limit',
        price: order.bidPrice,
        volume: 0, // 0 for close all
        leverage: order.leverageAmount,
        // validate: order.validate,
      });
      logOrderResult(`Settled`, latestResult, order.krakenizedTradingViewTicker);
    }

    if (!latestResult) {
      console.log('Nothing to close');
    }

    return latestResult;
  }

  async cancelOpenOrdersForPair(order: KrakenOrderDetails, orderType: 'buy' | 'sell') {
    const open = order.openOrders?.open;

    if (!open) return;

    await this.cancelOrdersOlderThanLimit(order);

    let result;
    for (const key in open) {
      const pair = open[key]['descr']['pair'];
      const type = open[key]['descr']['type'];

      if (pair === order.krakenizedTradingViewTicker && type === orderType) {
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

  async cancelOrdersOlderThanLimit(order: KrakenOrderDetails) {
    let result;
    const open = order.openOrders?.open;

    if (!open) return;

    for (const key in open) {
      const pair = open[key]['descr']['pair'];
      const type = open[key]['descr']['type'];
      const starttm = open[key]['opentm'];
      const startDate = new Date(starttm * 1000).toUTCString();
      const timeLimit = new Date(Date.now() - 10 * 60 * 1000).toUTCString(); // 10 min

      if (startDate < timeLimit) {
        console.log(`Old ${type} ${pair}. Cancelling.`);
        result = await this.kraken.setCancelOrder({ txid: key });
      }
    }
    return result;
  }

  async handleBags(order: KrakenOrderDetails): Promise<KrakenOrderResponse | undefined> {
    let totalVolumeToTradeInDollar: number, result;

    // local meaning don't close leverage orders
    if (!order.nonLeverageOnly) {
      result = await this.handleLeveragedOrder(order);
      logOrderResult(`ORDER`, result, order.krakenizedTradingViewTicker);
    }

    // convert to dollar. If greater than 1 bag size, we assume it's a dollar amount, else percent
    if (order.bagAmount && order.bagAmount > 1) {
      totalVolumeToTradeInDollar = superParseFloat(order.bagAmount, order.volumeDecimals);
    } else if (order.buyBags) {
      const bagAmount = order.bagAmount ? order.bagAmount : 0.4;
      totalVolumeToTradeInDollar = superParseFloat(
        order.balanceOfQuote * bagAmount,
        order.volumeDecimals
      );
    } else {
      const bagAmount = order.bagAmount ? order.bagAmount : 0.75;
      totalVolumeToTradeInDollar = superParseFloat(
        order.balanceOfBase * order.usdValueOfBase * bagAmount,
        order.volumeDecimals
      );
    }

    let volumeTradedInDollar = 0;
    let i = 0;
    let volumeLeft = totalVolumeToTradeInDollar;
    // for (let volumeLeft = totalVolumeToTradeInDollar, )
    while (volumeTradedInDollar < totalVolumeToTradeInDollar) {
      if (i > 8) {
        console.log(`Something went wrong buying bags, canceling`);
        break;
      }
      // if margin too low for volume, we'll sell 80% at a time
      const newOrder = <KrakenOrderDetails>{ ...order };
      newOrder.tradeVolume =
        newOrder.marginFree < volumeLeft
          ? superParseFloat(
              (newOrder.marginFree * 0.8) / newOrder.usdValueOfBase,
              newOrder.volumeDecimals
            )
          : volumeLeft / newOrder.usdValueOfBase;

      if (newOrder.tradeVolume < newOrder.minVolume) {
        console.log(`Trade volume too low. Ignoring the last bit. ${volumeTradedInDollar} Traded.`);
        return;
      }

      volumeTradedInDollar += newOrder.tradeVolume * newOrder.usdValueOfBase;
      volumeLeft = totalVolumeToTradeInDollar - volumeTradedInDollar;

      console.log(`Volume being executed ${newOrder.tradeVolume}`);
      console.log(
        `Traded ${volumeTradedInDollar} of ${totalVolumeToTradeInDollar}. Volume Remaining: ${volumeLeft}`
      );

      // no way of knowing when the leveraged order is filled, so we'll wait
      setTimeout(async () => {
        const { price } = await kraken.getPrice(newOrder.krakenTicker);
        const currentBid = superParseFloat(
          price[newOrder.krakenTicker]['b'][0],
          newOrder.priceDecimals
        );
        const currentAsk = superParseFloat(
          price[newOrder.krakenTicker]['a'][0],
          newOrder.priceDecimals
        );
        newOrder.bidPrice = newOrder.action === 'buy' ? currentAsk : currentBid;

        // order
        result = await this.handleNonLeveragedOrder(newOrder);
        console.log('-'.repeat(26));
      }, 18000 * i);
      i++;
    }
    return result;
  }

  async settleTxId(
    position: KrakenOpenPosition,
    order: KrakenOrderDetails,
    immediate = true,
    additionalVolume = 0
  ) {
    const closeAction = position.type === 'sell' ? 'buy' : 'sell';
    // const volumeToClose = parseFloat(position.vol) - parseFloat(position.vol_closed);
    const volumeToClose = parseFloat(position.vol) + additionalVolume;
    let bidPrice = order.bidPrice;
    let leverageAmount = order.leverageAmount;

    // if tx is not this pair, get data for it. used mostly in settle oldest transaction
    // if (position.pair !== order.krakenTicker) {
    const { price } = await kraken.getPrice(position.pair);
    const { pair } = await kraken.getPair(position.pair);

    const currentBid = price[position.pair]['b'][0];
    const currentAsk = price[position.pair]['a'][0];
    const leverageBuyAmounts = pair[position.pair]['leverage_buy'];
    const leverageSellAmounts = pair[position.pair]['leverage_sell'];

    // TODO: Calculate this better
    if (!immediate && position.pair === order.krakenTicker) {
      // update bid and ask since we've got it
      // TODO: allow getbid for non similar pair
      order.currentAsk = parseFloat(currentAsk);
      order.currentBid = parseFloat(currentBid);
      bidPrice = order.getBid();
    } else {
      bidPrice = position.type === 'buy' ? parseFloat(currentAsk) : parseFloat(currentBid);
    }
    leverageAmount =
      position.type === 'buy'
        ? leverageBuyAmounts[leverageBuyAmounts.length - 1]
        : leverageSellAmounts[leverageSellAmounts.length - 1];

    console.log(`Bid for Pair: ${currentBid} | Ask for Pair: ${currentAsk} | My Bid: ${bidPrice}`);

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
      console.log('Could not sell oldest. Combining');
      const positions = await this.getOrdersByTimeAsc(position.pair);

      result = await this.settleTxId(positions[1], order, false, volumeToClose);
    }
    logOrderResult(`SETTLED`, result, position.pair);

    return result;
  }

  async sellOldestOrders(
    order: KrakenOrderDetails,
    pair: string,
    openPositions?: KrakenOpenPositions,
    count = 1
  ) {
    let pairPositions;
    if (!openPositions) {
      pairPositions = await this.getOrdersByTimeAsc(pair);
    } else {
      pairPositions = await this.getOrdersByTimeAsc(pair, openPositions);
    }

    const { openOrders } = await this.getOpenOrders();

    let result;
    for (let i = 0; i < count; i++) {
      let positionToClose: KrakenOpenPosition | undefined = pairPositions[i];

      const open = openOrders?.open;
      for (const orderId in open) {
        const openOrder = open[orderId];
        // if position to close is already open, go to next position
        positionToClose =
          openOrder.descr.pair === positionToClose?.pair && openOrder.vol === positionToClose?.vol
            ? pairPositions[i + 1]
            : positionToClose;
      }

      if (positionToClose) {
        result = await this.settleTxId(positionToClose, order, true);
      } else {
        console.log(`Couldn't find position to close`);
      }
    }

    return result;
  }

  // async getPositionsForPair()

  async getOrdersByTimeAsc(
    // order: KrakenOpenPosition | KrakenOrderDetails,
    pair?: string,
    openPositions?: KrakenOpenPositions
  ): Promise<KrakenOpenPosition[]> {
    if (!openPositions) {
      const positionResult = await this.getOpenPositions();
      openPositions = positionResult.openPositions;
    }

    // const action = this.isOpenPosition(pair) ? pair.type : pair.action;
    // const pairTicker = this.isOpenPosition(order) ? order.pair : order.krakenTicker;

    let positions = [];
    for (const key in openPositions) {
      const position = openPositions[key];
      if (!pair || pair === position.pair) {
        positions.push(position);
      }
    }

    return positions.sort((a, b) => a.time - b.time);
  }

  async getOpenPositionsBySize(openPositions?: KrakenOpenPositions) {
    if (!openPositions) {
      const positionResult = await this.getOpenPositions();
      openPositions = positionResult.openPositions;
    }

    let positions = new Map();
    for (const key in openPositions) {
      const position = openPositions[key];

      const currentCost = positions.has(position.pair) ? positions.get(position.pair) : 0;
      positions.set(position.pair, currentCost + parseFloat(position.cost));
    }
    // thanks stack overflow
    return new Map([...positions.entries()].sort((a, b) => b[1] - a[1]));
  }

  isOpenPosition(
    whatIsIt: KrakenOpenPosition | KrakenOrderDetails
  ): whatIsIt is KrakenOpenPosition {
    return (
      (<KrakenOpenPosition>whatIsIt).type !== undefined &&
      (<KrakenOpenPosition>whatIsIt).pair !== undefined
    );
  }

  // async balancePortfolio() {
  //   const { balances } = await this.getBalance();
  //   console.log('USD Balance Before Rebalance:', balances['ZUSD']);

  //   const { openPositions } = await this.getOpenPositions();

  //   let longEthBtc, longBtcUsd, longEthUsd;
  //   for (const key in openPositions) {
  //     const pair = openPositions[key]['pair'];
  //     const type = openPositions[key]['type'];

  //     if (pair === 'XETHXXBT') {
  //       longEthBtc = type === 'buy';
  //     } else if (pair === 'XXBTZUSD') {
  //       longBtcUsd = type === 'buy';
  //     } else if (pair === 'XETHZUSD') {
  //       longEthUsd = type === 'buy';
  //     }
  //   }

  //   console.log(longEthBtc, longBtcUsd, longEthUsd);

  //   return balances;
  // }
}

const krakenApi = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);
export const kraken = new KrakenService(krakenApi);
