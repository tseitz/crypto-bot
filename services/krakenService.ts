const Kraken = require('kraken-wrapper'); // no d.ts file... gotta figure out heroku deploy
import Order from '../models/Order';
import {
  KrakenPriceResult,
  KrakenTradeablePairResult,
  KrakenOrderResult,
  KrakenBalanceResult,
} from '../models/KrakenResult';
import { KrakenOpenPosition } from '../models/KrakenOpenPosition';
import { TradingViewBody } from '../models/TradingViewBody';

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

export class KrakenOrder {
  requestBody: TradingViewBody;
  tradingViewTicker: string;
  krakenTicker: string;

  constructor(requestBody: TradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
    // Kraken uses XBT instead of BTC. Uniswap uses WETH instead of ETH
    // I use binance/uniswap for most webhooks since there is more volume
    this.krakenTicker = this.tradingViewTicker.replace('BTC', 'XBT').replace('WETH', 'ETH');
  }

  async placeOrder(): Promise<KrakenOrderResult> {
    // get pair data
    const { pairError, pairData } = await kraken.getPair(this.krakenTicker);
    if (pairError.length > 0) {
      console.log(`Pair data for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult(`Pair data for ${this.krakenTicker} not available on Kraken`);
    }

    // get pair price info for order
    const { priceError, priceData } = await kraken.getPrice(this.krakenTicker);
    if (priceError.length > 0) {
      console.log(`Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult(`Price info for ${this.krakenTicker} not available on Kraken`);
    }

    // btc or eth price for calculations (we're currently placing orders in fixed USD amount)
    const assetClass = this.krakenTicker.includes('XBT') ? 'XBTUSDT' : 'ETHUSDT';
    const { priceError: assetClassError, priceData: assetClassData } = await kraken.getPrice(
      assetClass
    );
    if (assetClassError.length > 0) {
      console.log(`Asset Class Price info for ${this.krakenTicker} not available on Kraken`);
      return new KrakenOrderResult(
        `Asset Class Price info for ${this.krakenTicker} not available on Kraken`
      );
    }

    const { balanceError, balanceData } = await kraken.getBalance();
    if (balanceError.length > 0) {
      console.log(`Could not find balance info for ${this.krakenTicker} on Kraken`);
      return new KrakenOrderResult(
        `Could not find balance info for ${this.krakenTicker} on Kraken`
      );
    }

    // set up the order
    const order = new Order(this.requestBody, pairData, priceData, assetClassData, balanceData);

    // execute the order
    if (order.closeOnly) {
      const closeOrderResult = await kraken.handleLeveragedOrder(order, true, true);
      return closeOrderResult;
    }

    return await kraken.openOrder(order);
  }
}

const krakenApi = new Kraken(process.env.KRAKEN_API_KEY, process.env.KRAKEN_SECRET_KEY);
export const kraken = new KrakenService(krakenApi);
