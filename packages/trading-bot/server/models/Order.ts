import { TradingViewBody } from "./TradingViewBody";
import { KrakenTradeablePair } from "./KrakenTradeablePair";

class Order {
  tradingViewTicker: string;
  krakenTicker: string;
  orderAction: string;
  close: boolean;
  orderMin: number;
  baseOfPair: string;
  leverageBuyAmounts: number[];
  leverageSellAmounts: number[];
  leverageBuyAmount: number;
  leverageSellAmount: number;
  orderLeverageAmount: number;
  decimals: number;

  constructor(body: TradingViewBody, krakenTradeablePair: KrakenTradeablePair) {
    this.tradingViewTicker = body.ticker;
    this.krakenTicker = Object.keys(krakenTradeablePair)[0];
    this.orderAction = body.strategy.action;
    this.close = body.strategy.description.toLowerCase().includes('close') ? true : false;
    this.orderMin = krakenTradeablePair[this.krakenTicker]['ordermin'];
    this.baseOfPair = krakenTradeablePair[this.krakenTicker]['base'];
    this.leverageBuyAmounts = krakenTradeablePair[this.krakenTicker]['leverage_buy'];
    this.leverageSellAmounts = krakenTradeablePair[this.krakenTicker]['leverage_sell'];
    this.leverageBuyAmount = this.leverageBuyAmounts[0]; // leverageBuy.length - 1
    this.leverageSellAmount = this.leverageSellAmounts[0]; // leverageSell.length - 1
    this.orderLeverageAmount = this.orderAction === 'sell' ? this.leverageSellAmount : this.leverageBuyAmount;
    this.decimals = krakenTradeablePair[this.krakenTicker]['pair_decimals'];
  }
}