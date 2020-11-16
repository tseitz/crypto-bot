import { TradingViewBody } from './TradingViewBody';
import { KrakenTradeablePair } from './KrakenTradeablePair';
import { KrakenPriceInfo } from './KrakenPriceInfo';

export default class Order {
  krakenApi: any;
  tradingViewTicker: string;
  krakenTicker: string;
  action: string;
  oppositeAction: string;
  // close: boolean;
  minVolume: number;
  baseOfPair: string;
  btcPair: boolean;
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
  btcPrice: number;
  bidPriceInDollar: number;
  usdOrderValue: number;
  stopLoss: number;
  stopPercent: number;

  constructor(
    kraken: any,
    body: TradingViewBody,
    krakenTradeablePair: KrakenTradeablePair,
    pairPriceInfo: KrakenPriceInfo,
    btcPriceInfo: KrakenPriceInfo
  ) {
    this.krakenApi = kraken;
    this.tradingViewTicker = body.ticker;
    this.krakenTicker = Object.keys(krakenTradeablePair)[0];
    this.action = body.strategy.action;
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    // this.close = body.strategy.description.toLowerCase().includes('close') ? true : false;
    this.minVolume = Number.parseFloat(
      krakenTradeablePair[this.krakenTicker]['ordermin'].toString()
    );
    this.baseOfPair = krakenTradeablePair[this.krakenTicker]['base'];
    this.btcPair = /XBT$/.test(this.krakenTicker);
    this.leverageBuyAmounts = krakenTradeablePair[this.krakenTicker]['leverage_buy'];
    this.leverageSellAmounts = krakenTradeablePair[this.krakenTicker]['leverage_sell'];
    this.leverageBuyAmount = this.leverageBuyAmounts[this.leverageBuyAmounts.length - 1];
    this.leverageSellAmount = this.leverageSellAmounts[this.leverageSellAmounts.length - 1];
    this.leverageAmount = this.action === 'sell' ? this.leverageSellAmount : this.leverageBuyAmount;
    this.decimals = krakenTradeablePair[this.krakenTicker]['pair_decimals'];
    this.currentPrice = Number.parseFloat(pairPriceInfo[this.krakenTicker]['c'][0]);
    this.currentBid = Number.parseFloat(pairPriceInfo[this.krakenTicker]['b'][0]);
    this.currentAsk = Number.parseFloat(pairPriceInfo[this.krakenTicker]['a'][0]);
    this.btcPrice = Number.parseFloat(btcPriceInfo['XBTUSDT']['c'][0]);
    this.bidPriceInDollar = this.btcPair ? this.btcPrice * this.currentBid : this.currentBid;
    this.volume = this.getVolume();
    this.usdOrderValue = Number.parseFloat((this.bidPriceInDollar * this.volume).toFixed(2)); // total value bought
    this.stopPercent = 12;
    this.stopLoss = this.getStopLoss();
  }

  private getVolume(): number {
    // let's risk $50 for now
    const volume = Number.parseFloat((75 / this.bidPriceInDollar).toFixed(this.decimals));
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
