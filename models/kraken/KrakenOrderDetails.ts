import { TradingViewBody } from '../TradingViewBody';
import { KrakenTradeablePair, KrakenPrice, KrakenBalance, KrakenOpenOrders } from './KrakenResults';
import { StrategyParams, StrategyParamsJson } from '../StrategyParams';
const strategyParams: StrategyParamsJson = require('../../strategies/strategy-params');

type AssetClassTicker = 'XBTUSDT' | 'ETHUSDT';

export default class KrakenOrderDetails {
  tradingViewTicker: string;
  krakenizedTradingViewTicker: string;
  krakenTicker: string;
  assetClassTicker: AssetClassTicker;
  action: string;
  oppositeAction: string;
  close: boolean;
  // closeOnly: boolean;
  minVolume: number;
  baseOfPair: string;
  quoteOfPair: string;
  usdPair: boolean;
  leverageBuyAmounts: number[];
  leverageSellAmounts: number[];
  leverageBuyAmount: number | undefined;
  leverageSellAmount: number | undefined;
  lowestLeverageAmount: number | undefined;
  leverageAmount: number | undefined;
  priceDecimals: number;
  volumeDecimals: number;
  tradeVolume: number;
  addVolume: number;
  tradingViewPrice: number;
  currentPrice: number;
  currentBid: number;
  currentAsk: number;
  stopLoss: number;
  stopPercent: number;
  strategyParams: StrategyParams;
  balanceOfBase: number;
  balanceOfQuote: number;
  tradeBalance: number;
  tradeBalanceInDollar: number;
  usdValueOfQuote: number;
  usdValueOfBase: number;
  positionSize: number | undefined;
  spread: number;
  bidPrice: number;
  openOrders: KrakenOpenOrders;

  constructor(
    body: TradingViewBody,
    krakenizedTicker: string,
    pairData: KrakenTradeablePair,
    pairPriceInfo: KrakenPrice,
    assetClassPriceInfo: KrakenPrice,
    myBalanceInfo: KrakenBalance,
    openOrders: KrakenOpenOrders
  ) {
    // ticker info
    this.tradingViewTicker = body.ticker;
    this.krakenizedTradingViewTicker = krakenizedTicker;
    this.krakenTicker = Object.keys(pairData)[0];
    this.baseOfPair = pairData[this.krakenTicker]['base'];
    this.quoteOfPair = pairData[this.krakenTicker]['quote'];
    this.assetClassTicker =
      Object.keys(assetClassPriceInfo)[0] === 'ETHUSDT' ? 'ETHUSDT' : 'XBTUSDT';
    this.openOrders = openOrders;

    // setup params
    this.strategyParams = strategyParams[this.tradingViewTicker];
    this.positionSize = undefined;
    this.action = body.strategy.action;
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    this.close = body.strategy.description.toLowerCase().includes('close') ? true : false;
    // this.closeOnly = body.strategy.description.toLowerCase().includes('close') ? true : false;

    // pair info
    this.minVolume = Number.parseFloat(pairData[this.krakenTicker]['ordermin'].toString());
    this.usdPair = !/XBT$|ETH$/.test(this.krakenTicker);
    this.priceDecimals = pairData[this.krakenTicker]['pair_decimals'];
    this.volumeDecimals = pairData[this.krakenTicker]['lot_decimals'];

    // leverage info
    this.leverageBuyAmounts = pairData[this.krakenTicker]['leverage_buy'];
    this.leverageSellAmounts = pairData[this.krakenTicker]['leverage_sell'];
    this.leverageBuyAmount = this.leverageBuyAmounts[this.leverageBuyAmounts.length - 1];
    this.leverageSellAmount = this.leverageSellAmounts[this.leverageSellAmounts.length - 1];
    this.leverageAmount = this.action === 'sell' ? this.leverageSellAmount : this.leverageBuyAmount;
    this.lowestLeverageAmount =
      this.action === 'sell' ? this.leverageSellAmounts[0] : this.leverageBuyAmounts[0];

    // current price info
    this.tradingViewPrice = Number.parseFloat(
      Number.parseFloat(body.strategy.price).toFixed(this.priceDecimals)
    );
    this.currentPrice = Number.parseFloat(
      Number.parseFloat(pairPriceInfo[this.krakenTicker]['c'][0]).toFixed(this.priceDecimals)
    );
    this.currentBid = Number.parseFloat(
      Number.parseFloat(pairPriceInfo[this.krakenTicker]['b'][0]).toFixed(this.priceDecimals)
    );
    this.currentAsk = Number.parseFloat(
      Number.parseFloat(pairPriceInfo[this.krakenTicker]['a'][0]).toFixed(this.priceDecimals)
    );
    this.spread = this.currentAsk - this.currentBid;
    this.bidPrice = this.getBid();
    // console.log(
    //   this.action === 'buy'
    //     ? `${this.currentBid} : ${this.bidPrice} : ${this.currentAsk}`
    //     : `${this.currentBid} : ${this.bidPrice} : ${this.currentAsk}`
    // );
    this.usdValueOfQuote = this.usdPair
      ? 1
      : Number.parseFloat(assetClassPriceInfo[this.assetClassTicker]['c'][0]);
    this.usdValueOfBase = this.convertBaseToDollar(this.currentPrice, this.usdValueOfQuote);

    console.log(
      `${this.action.toUpperCase()} TradingView Price: ${Number.parseFloat(
        body.strategy.price
      ).toFixed(this.priceDecimals)}, Bid Price: ${this.currentBid}, Ask Price: ${
        this.currentAsk
      }, My Bid: ${this.bidPrice}`
    );

    // balance and order info
    this.balanceOfBase = Number.parseFloat(myBalanceInfo[this.baseOfPair]);
    this.balanceOfQuote = Number.parseFloat(myBalanceInfo[this.quoteOfPair]);
    this.tradeBalance = this.action === 'sell' ? this.balanceOfBase : this.balanceOfQuote;
    this.tradeBalanceInDollar = this.convertBaseToDollar(this.tradeBalance, this.usdValueOfBase);
    this.stopPercent = 12;
    this.tradeVolume = this.getVolume();
    this.addVolume = this.getAddVolume();
    this.stopLoss = this.getStopLoss();
  }

  private getVolume(): number {
    let volume = 0;
    if (this.positionSize) {
      volume = Number.parseFloat(
        ((this.positionSize / 100) * this.tradeBalanceInDollar).toFixed(this.volumeDecimals)
      );
    } else {
      volume = Number.parseFloat(
        ((85 * (this.leverageAmount || 1)) / this.usdValueOfBase).toFixed(this.volumeDecimals)
      );
    }
    return volume > this.minVolume ? volume : this.minVolume;
  }

  private getAddVolume(): number {
    let volume = Number.parseFloat(
      ((55 * (this.leverageAmount || 1)) / this.usdValueOfBase).toFixed(this.volumeDecimals)
    );
    return volume > this.minVolume ? volume : this.minVolume;
  }

  private getStopLoss(): number {
    const stop =
      this.action === 'sell'
        ? this.currentBid * (1 + this.stopPercent / 100)
        : this.currentBid * (1 - this.stopPercent / 100);
    return Number.parseFloat(stop.toFixed(this.priceDecimals));
  }

  private getBid(): number {
    if (isNaN(this.tradingViewPrice)) {
      return this.action === 'buy' ? this.currentAsk : this.currentBid;
    } else {
      // if it's running away long or short, buy it, otherwise average it out
      if (this.action === 'buy') {
        if (this.tradingViewPrice >= this.currentAsk) {
          return this.currentAsk;
        } else if (
          this.tradingViewPrice <= this.currentAsk &&
          this.tradingViewPrice >= this.currentBid
        ) {
          return this.tradingViewPrice;
        } else {
          return (this.currentBid + this.currentAsk) / 2;
        }
        // return Number.parseFloat(
        //   Number.parseFloat(
        //     ((this.tradingViewPrice + this.currentAsk + this.currentBid) / 3).toString()
        //   ).toFixed(this.priceDecimals)
        // );
      } else {
        if (this.tradingViewPrice <= this.currentBid) {
          return this.currentBid;
        } else {
          return Number.parseFloat(
            Number.parseFloat(
              ((this.tradingViewPrice + this.currentAsk + this.currentBid) / 3).toString()
            ).toFixed(this.priceDecimals)
          );
        }
      }
    }
  }

  convertBaseToDollar(base: number, usd: number): number {
    return base * usd;
  }
}
