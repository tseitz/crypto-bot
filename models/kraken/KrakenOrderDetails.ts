import { TradingViewBody } from '../TradingViewBody';
import { KrakenTradeablePair, KrakenPrice, KrakenBalance } from './KrakenResults';
import { StrategyParams, StrategyParamsJson } from '../StrategyParams';
const strategyParams: StrategyParamsJson = require('../../strategies/strategy-params');

type AssetClassTicker = 'XBTUSDT' | 'ETHUSDT';

export default class KrakenOrderDetails {
  tradingViewTicker: string;
  krakenTicker: string;
  assetClassTicker: AssetClassTicker;
  action: string;
  oppositeAction: string;
  closeOnly: boolean;
  minVolume: number;
  baseOfPair: string;
  quoteOfPair: string;
  usdPair: boolean;
  leverageBuyAmounts: number[];
  leverageSellAmounts: number[];
  leverageBuyAmount: number | undefined;
  leverageSellAmount: number | undefined;
  leverageAmount: number | undefined;
  priceDecimals: number;
  volumeDecimals: number;
  tradeVolume: number;
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

  constructor(
    body: TradingViewBody,
    pairData: KrakenTradeablePair,
    pairPriceInfo: KrakenPrice,
    assetClassPriceInfo: KrakenPrice,
    myBalanceInfo: KrakenBalance
  ) {
    // ticker info
    this.tradingViewTicker = body.ticker;
    this.krakenTicker = Object.keys(pairData)[0];
    this.baseOfPair = pairData[this.krakenTicker]['base'];
    this.quoteOfPair = pairData[this.krakenTicker]['quote'];
    this.assetClassTicker =
      Object.keys(assetClassPriceInfo)[0] === 'ETHUSDT' ? 'ETHUSDT' : 'XBTUSDT';

    // setup params
    this.strategyParams = strategyParams[this.tradingViewTicker];
    this.positionSize = undefined;
    this.action = body.strategy.action;
    this.oppositeAction = this.action === 'sell' ? 'buy' : 'sell';
    this.closeOnly = body.strategy.description.toLowerCase().includes('close only') ? true : false;

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

    // current price info
    this.currentPrice = Number.parseFloat(pairPriceInfo[this.krakenTicker]['c'][0]);
    this.currentBid = Number.parseFloat(pairPriceInfo[this.krakenTicker]['b'][0]);
    this.currentAsk = Number.parseFloat(pairPriceInfo[this.krakenTicker]['a'][0]);
    this.spread = this.currentAsk - this.currentBid;
    this.bidPrice = this.getBid();
    this.usdValueOfQuote = this.usdPair
      ? 1
      : Number.parseFloat(assetClassPriceInfo[this.assetClassTicker]['c'][0]);
    this.usdValueOfBase = this.convertBaseToDollar(this.currentPrice, this.usdValueOfQuote);

    // balance and order info
    this.balanceOfBase = Number.parseFloat(myBalanceInfo[this.baseOfPair]);
    this.balanceOfQuote = Number.parseFloat(myBalanceInfo[this.quoteOfPair]);
    this.tradeBalance = this.action === 'sell' ? this.balanceOfBase : this.balanceOfQuote;
    this.tradeBalanceInDollar = this.convertBaseToDollar(this.tradeBalance, this.usdValueOfBase);
    this.stopPercent = 12;
    this.tradeVolume = this.getVolume();
    this.stopLoss = this.getStopLoss();
  }

  private getKrakenTicker(pairData: KrakenTradeablePair): string {
    let ticker = Object.keys(pairData)[0];

    if (ticker.includes('USDT') && ticker !== 'XBTUSDT' && ticker !== 'ETHUSDT') {
      ticker = ticker.replace('USDT', 'USD');
    }

    return ticker;
  }

  private getVolume(): number {
    let volume = 0;
    if (this.positionSize) {
      volume = Number.parseFloat(
        ((this.positionSize / 100) * this.tradeBalanceInDollar).toFixed(this.volumeDecimals)
      );
    } else {
      // let's risk $200 for now
      volume = Number.parseFloat(
        ((75 * (this.leverageAmount || 1.1)) / this.usdValueOfBase).toFixed(this.volumeDecimals)
      );
    }
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
    if (this.action === 'buy') {
      return Number.parseFloat(
        (
          Number.parseFloat(this.currentBid.toFixed(this.priceDecimals)) +
          Number.parseFloat(this.spread.toFixed(this.priceDecimals)) * 0.9
        ).toFixed(this.priceDecimals)
      ); // 90% of current ask, trying to fill
    } else {
      return Number.parseFloat(
        (
          Number.parseFloat(this.currentAsk.toFixed(this.priceDecimals)) -
          Number.parseFloat(this.spread.toFixed(this.priceDecimals)) * 0.9
        ).toFixed(this.priceDecimals)
      ); // 90% of current ask, trying to fill
    }
  }

  convertBaseToDollar(base: number, usd: number): number {
    return base * usd;
  }
}
