import Order from '../models/Order';
import { KrakenPriceInfoResult, KrakenTradeablePairResult } from '../models/KrakenResult';
import { KrakenOpenPosition } from '../models/KrakenOpenPosition';

export class KrakenService {
  kraken: any;

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
    }: KrakenPriceInfoResult = await this.kraken.getTickerInformation({
      pair: krakenTicker,
    });

    return { priceError, priceData };
  }

  async openOrder(order: Order) {
    let result;
    if (typeof order.leverageAmount === 'undefined') {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  // async closeOrder(order: Order) {
  //   let result;
  //   if (typeof order.leverageAmount === 'undefined') {
  //     result = await handleNonLeveragedOrder(order);
  //   } else {
  //     result = await settleLeveragedOrder(order);
  //   }

  //   console.log('Closing Request: ', result);
  //   return result;
  // }

  async settleLeveragedOrder(order: Order) {
    const {
      error: openPositionError,
      result: openPositions,
    } = await this.kraken.getOpenPositions();

    // close out positons first
    const closedPositions = [];
    for (const key in openPositions) {
      const position: KrakenOpenPosition = openPositions[key];
      if (position.pair === order.krakenTicker) {
        const closeAction = position.type === 'sell' ? 'buy' : 'sell';
        const result = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: closeAction,
          ordertype: 'limit',
          price: order.currentAsk,
          volume: position.vol, // only close current volume. 0 for close all
          leverage: order.leverageAmount,
          // validate: true,
        });
        closedPositions.push(result);
      }
    }

    console.log('Settled Positions: ', closedPositions);
    return closedPositions;
  }

  async handleLeveragedOrder(
    order: Order,
    closeOpenPositions = true,
    onlyCloseOpenPositions = false
  ) {
    // TODO: pass this along in the request body. Sometimes we don't want to close positions first
    if (closeOpenPositions) {
      const result = await this.settleLeveragedOrder(order);

      if (onlyCloseOpenPositions) return result;
    }

    const result = await this.kraken.setAddOrder({
      pair: order.krakenTicker,
      type: order.action,
      ordertype: 'stop-loss',
      price: order.stopLoss,
      // price2: currentBid,
      volume: order.volume,
      leverage: order.leverageAmount,
      // validate: true,
    });

    console.log('Leveraged Order Complete: ', result);
    return result;
  }

  async handleNonLeveragedOrder(order: Order) {
    const { error: balanceError, result: balanceResult } = await this.kraken.getBalance();
    const pairBalance = balanceResult[order.baseOfPair];

    let result;
    if (order.action === 'sell') {
      // sell off current balance, we cannot short so stop there
      result = await this.kraken.setAddOrder({
        pair: order.krakenTicker,
        type: order.action,
        ordertype: 'limit',
        volume: pairBalance,
        price: order.currentAsk,
        // validate: true,
      });
    } else {
      result = await this.kraken.setAddOrder({
        pair: order.krakenTicker,
        type: order.action,
        ordertype: 'stop-loss',
        price: order.stopLoss,
        // price2: currentBid,
        volume: order.volume,
        // validate: true,
      });
    }

    console.log('Non Leveraged Order Complete: ', result);
    return result;
  }
}
