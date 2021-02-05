import { TradingViewBody } from '../TradingViewBody';
import {
  KrakenTradeablePair,
  KrakenPrice,
  KrakenBalance,
  KrakenOpenOrders,
  KrakenOrderResult,
} from './KrakenResults';
import { StrategyParams, StrategyParamsJson } from '../StrategyParams';
import { superParseFloat } from '../../scripts/common';
const strategyParams: StrategyParamsJson = require('../../strategy-params');

type AssetClassTicker = 'XBTUSDT' | 'ETHUSDT';

export default class KrakenOrderDetails {
  tradingViewTicker: string;
  krakenizedTradingViewTicker: string;
  krakenTicker: string;
  assetClassTicker: AssetClassTicker;
  action: 'buy' | 'sell';
  oppositeAction: 'buy' | 'sell';
  close: boolean;
  oldest: boolean;
  oldestPair: boolean;
  nonLeverageOnly: boolean;
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
  strategyParams: StrategyParams;
  balanceOfBase: number;
  balanceOfQuote: number;
  tradeBalance: number;
  tradeBalanceInDollar: number;
  usdValueOfQuote: number;
  usdValueOfBase: number;
  entrySize: number;
  addSize: number;
  spread: number;
  bidPrice: number;
  openOrders: KrakenOpenOrders;
  txId?: string;
  noLeverage: boolean;
  sellBags: boolean;
  buyBags: boolean;
  marginFree: number;
  tradeVolumeInDollar: number;
  balanceInDollar: number;
  maxVolumeInDollar: number;
  addCount: number;
  bagIt: boolean;
  bagAmount: number;
  positionSize: number | undefined;
  result: KrakenOrderResult | undefined;
  validate: boolean;
  addBoost: number;
  lowestNonLeverageMargin: number;
  lowestLeverageMargin: number;

  constructor(
    body: TradingViewBody,
    krakenizedTicker: string,
    pairData: KrakenTradeablePair,
    pairPriceInfo: KrakenPrice,
    assetClassPriceInfo: KrakenPrice,
    myBalanceInfo: KrakenBalance,
    openOrders: KrakenOpenOrders,
    tradeBalance: any
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
    this.marginFree = superParseFloat(tradeBalance?.mf);

    // setup params
    this.strategyParams = strategyParams[this.tradingViewTicker];
    this.positionSize = body.strategy?.positionSize;
    this.entrySize = this.strategyParams?.entrySize;
    this.addSize = this.strategyParams?.addSize;
    this.addCount = this.strategyParams?.maxAdds ? this.strategyParams.maxAdds : 6;
    this.action = body.strategy.action === 'sell' ? 'sell' : 'buy'; // force it
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    this.close = body.strategy.description.toLowerCase().includes('close');
    this.oldest = body.strategy.description.toLowerCase().includes('oldest');
    this.oldestPair = this.oldest && body.strategy.description.toLowerCase().includes('pair');
    this.nonLeverageOnly = body.strategy.description.toLowerCase().includes('local');
    this.txId = body.strategy.txId;
    this.sellBags = parseInt(body.strategy.sellBags?.toString() || '0') === 0 ? false : true;
    this.buyBags = parseInt(body.strategy.buyBags?.toString() || '0') === 0 ? false : true;
    this.bagAmount = parseFloat(body.strategy.bagSize?.toString() || '0');
    this.validate = body.strategy.validate || false;

    // pair info
    this.minVolume = superParseFloat(pairData[this.krakenTicker]['ordermin']);
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
    this.noLeverage = typeof this.leverageAmount === 'undefined';
    this.bagIt = this.sellBags || this.buyBags;

    // current price info
    this.tradingViewPrice = superParseFloat(body.strategy.price, this.priceDecimals);
    this.currentPrice = superParseFloat(
      pairPriceInfo[this.krakenTicker]['c'][0],
      this.priceDecimals
    );
    this.currentBid = superParseFloat(pairPriceInfo[this.krakenTicker]['b'][0], this.priceDecimals);
    this.currentAsk = superParseFloat(pairPriceInfo[this.krakenTicker]['a'][0], this.priceDecimals);

    this.spread = this.currentAsk - this.currentBid;
    this.bidPrice = this.getBid();
    // Quote = USDT or ETH/BTC, Base = AAVE, ADA etc.
    this.usdValueOfQuote = this.usdPair
      ? 1
      : superParseFloat(assetClassPriceInfo[this.assetClassTicker]['c'][0]);
    this.usdValueOfBase = this.convertBaseToDollar(this.currentPrice, this.usdValueOfQuote);

    // balance and order info
    this.balanceOfBase = superParseFloat(this.baseOfPair ? myBalanceInfo[this.baseOfPair] : 0) || 0;
    this.balanceOfQuote = superParseFloat(this.quoteOfPair ? myBalanceInfo[this.quoteOfPair] : 0);
    this.tradeBalance = this.action === 'sell' ? this.balanceOfBase : this.balanceOfQuote;
    this.balanceInDollar = this.convertBaseToDollar(this.balanceOfBase, this.usdValueOfBase);
    this.tradeBalanceInDollar = this.convertBaseToDollar(this.tradeBalance, this.usdValueOfQuote);
    this.tradeVolume = this.getTradeVolume();
    this.addVolume = this.getAddVolume();
    this.tradeVolumeInDollar = this.convertBaseToDollar(this.tradeVolume, this.usdValueOfBase);
    // if no leverage, 4 less add counts
    this.maxVolumeInDollar = this.entrySize + this.addSize * this.addCount;

    // local configs
    this.addBoost = 0.015;
    this.lowestNonLeverageMargin = 110;
    this.lowestLeverageMargin = 100;

    console.log(
      `Price: ${superParseFloat(body.strategy.price, this.priceDecimals)}, Bid: ${
        this.currentBid
      }, My Bid: ${this.bidPrice}, Ask: ${this.currentAsk}`
    );
    console.log(`Margin Available: ${this.marginFree}`);
  }

  private getTradeVolume(): number {
    let volume = 0;
    const size = this.positionSize || this.entrySize;

    if (size) {
      if (this.action === 'sell' && this.close) {
        return this.balanceOfBase;
      } else {
        volume = superParseFloat(
          (size * (this.leverageAmount || 1)) / this.usdValueOfBase,
          this.volumeDecimals
        );
        return volume > this.minVolume ? volume : this.minVolume;
      }
    } else {
      console.log('No size to enter. Using default. Fix please');
      if (this.action === 'sell') {
        return this.balanceOfBase;
      } else {
        volume = superParseFloat(
          (20 * (this.leverageAmount || 1)) / this.usdValueOfBase,
          this.volumeDecimals
        );
        return volume > this.minVolume ? volume : this.minVolume;
      }
    }
  }

  private getAddVolume(): number {
    let volume = 0;
    const size = this.positionSize || this.addSize;

    if (size) {
      volume = superParseFloat(
        (size * (this.leverageAmount || 1)) / this.usdValueOfBase,
        this.volumeDecimals
      );
      return volume > this.minVolume ? volume : this.minVolume;
    } else {
      volume = superParseFloat(
        (60 * (this.leverageAmount || 1)) / this.usdValueOfBase,
        this.volumeDecimals
      );
    }
    return volume > this.minVolume ? volume : this.minVolume;
  }

  // private getStopLoss(): number {
  //   const stop =
  //     this.action === 'sell'
  //       ? this.currentBid * (1 + this.stopPercent / 100)
  //       : this.currentBid * (1 - this.stopPercent / 100);
  //   return parseFloat(stop.toFixed(this.priceDecimals));
  // }

  public getBid(): number {
    // return this.action === 'buy' ? this.currentAsk : this.currentBid; // give it to the ask
    // YFI doesn't get filled as often so giving
    if (
      isNaN(this.tradingViewPrice) ||
      this.tradingViewTicker === 'DOTUSDT' ||
      this.tradingViewTicker === 'ATOMUSDT' ||
      this.tradingViewTicker === 'ADAUSDT' ||
      this.tradingViewTicker === 'LTCUSDT' ||
      this.tradingViewTicker === 'YFIUSDT' ||
      this.tradingViewTicker === 'SNXUSDT' ||
      this.tradingViewTicker === 'OMGUSDT' ||
      this.tradingViewTicker === 'XTZUSDT' ||
      (this.action === 'sell' && this.tradingViewTicker === 'KSMUSDT') ||
      (this.action === 'sell' && this.tradingViewTicker === 'XLMUSDT') ||
      (this.action === 'sell' && this.tradingViewTicker === 'LINKUSDT') ||
      (this.action === 'sell' && this.tradingViewTicker === 'UNIWETH') ||
      (this.action === 'sell' && this.tradingViewTicker === 'AAVEWETH')
    ) {
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
          return superParseFloat((this.currentBid + this.currentAsk) / 2, this.priceDecimals);
        }
        // return parseFloat(
        //   parseFloat(
        //     ((this.tradingViewPrice + this.currentAsk + this.currentBid) / 3).toString()
        //   ).toFixed(this.priceDecimals)
        // );
      } else {
        if (this.tradingViewPrice <= this.currentBid) {
          return this.currentBid;
        } else {
          return superParseFloat(
            (this.tradingViewPrice + this.currentAsk + this.currentBid) / 3,
            this.priceDecimals
          );
        }
      }
    }
  }

  convertBaseToDollar(base: number, usd: number): number {
    return superParseFloat(base * usd, 2);
  }
}
