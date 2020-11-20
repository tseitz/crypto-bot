import Order from '../models/Order';
import {
  KrakenPriceResult,
  KrakenTradeablePairResult,
  KrakenOrderResult,
  KrakenBalanceResult,
} from '../models/KrakenResult';
import { KrakenOpenPosition } from '../models/KrakenOpenPosition';

export class KrakenService {
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

  async getBalance(krakenTicker: string) {
    const {
      error: balanceError,
      result: balanceData,
    }: KrakenBalanceResult = await this.kraken.getBalance();

    return { balanceError, balanceData };
  }

  async openOrder(order: Order): Promise<KrakenOrderResult> {
    let result;
    if (typeof order.leverageAmount === 'undefined') {
      result = await this.handleNonLeveragedOrder(order);
    } else {
      result = await this.handleLeveragedOrder(order);
    }

    return result;
  }

  async settleLeveragedOrder(order: Order): Promise<KrakenOrderResult> {
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
        latestResult = await this.kraken.setAddOrder({
          pair: order.krakenTicker,
          type: closeAction,
          ordertype: 'limit',
          price: order.currentAsk,
          volume: position.vol, // only close current volume. 0 for close all
          leverage: order.leverageAmount,
          // validate: true,
        });
        console.log('Settled Position: ', latestResult);
      }
    }

    return latestResult;
  }

  async handleLeveragedOrder(
    order: Order,
    closeOpenPositions = true,
    onlyCloseOpenPositions = false
  ): Promise<KrakenOrderResult> {
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
      volume: order.tradeVolume,
      leverage: order.leverageAmount,
      // validate: true,
    });

    console.log('Leveraged Order Complete: ', result);
    return result;
  }

  async handleNonLeveragedOrder(order: Order): Promise<KrakenOrderResult> {
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
        volume: order.tradeVolume,
        // validate: true,
      });
    }

    console.log('Non Leveraged Order Complete: ', result);
    return result;
  }
}
