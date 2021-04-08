import { KrakenTradingViewBody } from "../TradingViewBody";
import BinanceOrderDetails from "./BinanceOrderDetails";
import { StrategyParamsJson } from "../StrategyParams";

const Binance = require("node-binance-api");
const strategyParams: StrategyParamsJson = require("../../strategy-params");

const binanceOpts = {
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_SECRET_KEY,
  test: true,
  // APIKEY: process.env.BINANCE_API_KEY,
  // APISECRET: process.env.BINANCE_SECRET_KEY,
}

const binance = new Binance().options(binanceOpts);

export class BinanceWebhookOrder {
  requestBody: KrakenTradingViewBody;
  tradingViewTicker: string;
  order?: BinanceOrderDetails;

  constructor(requestBody: KrakenTradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
  }

  async placeOrder() {
    try {
      // set up the order
      // this.order = new BinanceOrderDetails(await this.initOrder());
      console.log(binanceOpts)
      console.log(this.requestBody)
      
      const order = await binance.buy(this.requestBody.ticker, 1, 5)
      console.log(order.body)
      
      // execute the order
      // return await this.openOrder(this.order);
      return;
    } catch (error) {
      console.log(error);
      return error;
    }
  }

  private async initOrder() {
    // return order details
    return;
  }

  private async openOrder(
    order: BinanceOrderDetails
  ): Promise<undefined> {
    // order stuff
    return;
  }
}
