import { BinanceTradingViewBody } from "../TradingViewBody";
import BinanceOrderDetails from "./BinanceOrderDetails";
import { StrategyParamsJson } from "../StrategyParams";

const Binance = require("node-binance-api");
const strategyParams: StrategyParamsJson = require("../../strategy-params");

const binanceOpts = {
  APIKEY: process.env.BINANCE_TEST_API_KEY,
  APISECRET: process.env.BINANCE_TEST_SECRET_KEY,
  test: true,
  urls: {
    base: "https://testnet.binance.vision/api/",
  },
  // APIKEY: process.env.BINANCE_API_KEY,
  // APISECRET: process.env.BINANCE_SECRET_KEY,
};

const binance = new Binance().options(binanceOpts);

export class BinanceWebhookOrder {
  requestBody: BinanceTradingViewBody;
  tradingViewTicker: string;
  order?: BinanceOrderDetails;

  constructor(requestBody: BinanceTradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
  }

  async placeOrder() {
    try {
      const order = await binance.buy(
        this.tradingViewTicker,
        0.025, // TODO: calc this
        this.requestBody.strategy.price
      );
      console.log(order);

      return order;
    } catch (error) {
      console.log(error);
      return error;
    }
  }
}
