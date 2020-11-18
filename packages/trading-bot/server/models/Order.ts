import { TradingViewBody } from './TradingViewBody';
import { KrakenTradeablePair } from './KrakenTradeablePair';
import { KrakenPriceInfo } from './KrakenPriceInfo';

export default class Order {
  tradingViewTicker: string;
  krakenTicker: string;
  assetClassTicker: string;
  action: string;
  oppositeAction: string;
  closeOnly: boolean;
  minVolume: number;
  baseOfPair: string;
  usdPair: boolean;
  leverageBuyAmounts: number[];
  leverageSellAmounts: number[];
  leverageBuyAmount: number | undefined;
  leverageSellAmount: number | undefined;
  leverageAmount: number | undefined;
  decimals: number;
  volume: number;
  currentPrice: number;
  currentBid: number;
  currentAsk: number;
  assetClassPrice: number;
  assetClassPriceInDollar: number;
  usdOrderValue: number;
  stopLoss: number;
  stopPercent: number;

  constructor(
    body: TradingViewBody,
    pairData: KrakenTradeablePair,
    pairPriceInfo: KrakenPriceInfo,
    assetClassPriceInfo: KrakenPriceInfo
  ) {
    this.tradingViewTicker = body.ticker;
    this.krakenTicker = Object.keys(pairData)[0];
    this.assetClassTicker = Object.keys(assetClassPriceInfo)[0];
    this.action = body.strategy.action;
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    this.closeOnly = body.strategy.description.toLowerCase().includes('close only') ? true : false;
    this.minVolume = Number.parseFloat(pairData[this.krakenTicker]['ordermin'].toString());
    this.baseOfPair = pairData[this.krakenTicker]['base'];
    this.usdPair = !/XBT$|ETH$/.test(this.krakenTicker);
    this.leverageBuyAmounts = pairData[this.krakenTicker]['leverage_buy'];
    this.leverageSellAmounts = pairData[this.krakenTicker]['leverage_sell'];
    this.leverageBuyAmount = this.leverageBuyAmounts[this.leverageBuyAmounts.length - 1];
    this.leverageSellAmount = this.leverageSellAmounts[this.leverageSellAmounts.length - 1];
    this.leverageAmount = this.action === 'sell' ? this.leverageSellAmount : this.leverageBuyAmount;
    this.decimals = pairData[this.krakenTicker]['pair_decimals'];
    this.currentPrice = Number.parseFloat(pairPriceInfo[this.krakenTicker]['c'][0]);
    this.currentBid = Number.parseFloat(pairPriceInfo[this.krakenTicker]['b'][0]);
    this.currentAsk = Number.parseFloat(pairPriceInfo[this.krakenTicker]['a'][0]);
    this.assetClassPrice = Number.parseFloat(assetClassPriceInfo[this.assetClassTicker]['c'][0]);
    this.assetClassPriceInDollar = this.usdPair
      ? this.currentBid
      : this.assetClassPrice * this.currentBid;
    this.volume = this.getVolume();
    this.usdOrderValue = Number.parseFloat((this.assetClassPriceInDollar * this.volume).toFixed(2)); // total value bought
    this.stopPercent = 12;
    this.stopLoss = this.getStopLoss();
  }

  private getVolume(): number {
    // let's risk $75 for now
    const volume = Number.parseFloat((120 / this.assetClassPriceInDollar).toFixed(this.decimals));
    return volume > this.minVolume ? volume : this.minVolume;
  }

  private getStopLoss(): number {
    const stop =
      this.action === 'sell'
        ? this.currentBid * (1 + this.stopPercent / 100)
        : this.currentBid * (1 - this.stopPercent / 100);
    return Number.parseFloat(stop.toFixed(this.decimals));
  }
}
