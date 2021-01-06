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
    this.marginFree = this.superParseFloat(tradeBalance.mf);

    // setup params
    this.strategyParams = strategyParams[this.tradingViewTicker];
    this.entrySize = this.strategyParams?.entrySize;
    this.addSize = this.strategyParams?.addSize;
    this.action = body.strategy.action;
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    this.close = body.strategy.description.toLowerCase().includes('close') ? true : false;
    this.txId = body.strategy.txId;
    this.sellBags = parseInt(body.strategy.sellBags?.toString() || '0') === 0 ? false : true;
    this.buyBags = parseInt(body.strategy.buyBags?.toString() || '0') === 0 ? false : true;

    // pair info
    this.minVolume = this.superParseFloat(pairData[this.krakenTicker]['ordermin']);
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
    this.tradingViewPrice = this.superParseFloat(body.strategy.price, this.priceDecimals);
    this.currentPrice = this.superParseFloat(
      pairPriceInfo[this.krakenTicker]['c'][0],
      this.priceDecimals
    );
    this.currentBid = this.superParseFloat(
      pairPriceInfo[this.krakenTicker]['b'][0],
      this.priceDecimals
    );
    this.currentAsk = this.superParseFloat(
      pairPriceInfo[this.krakenTicker]['a'][0],
      this.priceDecimals
    );

    this.spread = this.currentAsk - this.currentBid;
    this.bidPrice = this.getBid();
    this.usdValueOfQuote = this.usdPair
      ? 1
      : this.superParseFloat(assetClassPriceInfo[this.assetClassTicker]['c'][0]);
    this.usdValueOfBase = this.convertBaseToDollar(this.currentPrice, this.usdValueOfQuote);

    // balance and order info
    this.balanceOfBase = this.superParseFloat(myBalanceInfo[this.baseOfPair]);
    this.balanceOfQuote = this.superParseFloat(myBalanceInfo[this.quoteOfPair]);
    this.tradeBalance = this.action === 'sell' ? this.balanceOfBase : this.balanceOfQuote;
    this.balanceInDollar = this.convertBaseToDollar(this.balanceOfBase, this.usdValueOfBase);
    this.tradeBalanceInDollar = this.convertBaseToDollar(this.tradeBalance, this.usdValueOfQuote);
    this.tradeVolume = this.getTradeVolume();
    this.addVolume = this.getAddVolume();
    this.tradeVolumeInDollar = this.convertBaseToDollar(this.tradeVolume, this.usdValueOfBase);
    this.addCount = 8;
    // if no leverage, 4 less add counts
    this.maxVolumeInDollar = this.noLeverage
      ? this.entrySize + this.addSize * (this.addCount - 4)
      : this.entrySize + this.addSize * this.addCount;

    console.log(
      `${this.action.toUpperCase()} TradingView Price: ${this.superParseFloat(
        body.strategy.price,
        this.priceDecimals
      )}, Bid: ${this.currentBid}, Ask: ${this.currentAsk}, My Bid: ${this.bidPrice}`
    );
  }

  public superParseFloat(floatString: number | string, decimals?: number) {
    floatString = floatString?.toString();
    return typeof decimals === 'undefined'
      ? parseFloat(floatString)
      : parseFloat(parseFloat(floatString).toFixed(decimals));
  }

  private getTradeVolume(): number {
    let volume = 0;
    if (this.entrySize) {
      if (this.action === 'sell') {
        return this.balanceOfBase;
      } else {
        return this.superParseFloat(
          (this.entrySize * (this.leverageAmount || 1)) / this.usdValueOfBase,
          this.volumeDecimals
        );
      }
    } else {
      console.log('No size to enter. Using default. Fix please');
      if (this.action === 'sell') {
        return this.balanceOfBase;
      } else {
        volume = this.superParseFloat(
          (80 * (this.leverageAmount || 1)) / this.usdValueOfBase,
          this.volumeDecimals
        );
        return volume > this.minVolume ? volume : this.minVolume;
      }
    }
  }

  private getAddVolume(): number {
    let volume = 0;
    if (this.addSize) {
      volume = this.superParseFloat(
        (this.addSize * (this.leverageAmount || 1)) / this.usdValueOfBase,
        this.volumeDecimals
      );
    } else {
      volume = this.superParseFloat(
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
  //   return Number.parseFloat(stop.toFixed(this.priceDecimals));
  // }

  private getBid(): number {
    // return this.action === 'buy' ? this.currentAsk : this.currentBid; // give it to the ask
    // YFI doesn't get filled as often so giving
    if (
      isNaN(this.tradingViewPrice) ||
      this.tradingViewTicker === 'DOTUSDT' ||
      this.tradingViewTicker === 'ATOMUSDT' ||
      // this.tradingViewTicker === 'LINKUSDT' ||
      this.tradingViewTicker === 'LTCUSDT' ||
      this.tradingViewTicker === 'YFIUSDT' ||
      (this.action === 'sell' && this.tradingViewTicker === 'KSMUSDT')
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
          return this.superParseFloat((this.currentBid + this.currentAsk) / 2, this.priceDecimals);
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
          return this.superParseFloat(
            (this.tradingViewPrice + this.currentAsk + this.currentBid) / 3,
            this.priceDecimals
          );
        }
      }
    }
  }

  convertBaseToDollar(base: number, usd: number): number {
    return this.superParseFloat(base * usd, 2);
  }
}
