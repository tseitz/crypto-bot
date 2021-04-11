import { GeminiTradingViewBody } from "../TradingViewBody";
// import BinanceOrderDetails from "./BinanceOrderDetails";
import { StrategyParamsJson } from "../StrategyParams";

// import { PublicClient } from "gemini-node-api";
import { AuthenticatedClient } from "gemini-node-api";
const strategyParams: StrategyParamsJson = require("../../strategy-params");

const key = process.env.GEMINI_SANDBOX_API_KEY as string;
const secret = process.env.GEMINI_SANDBOX_SECRET_KEY as string;
const client = new AuthenticatedClient({ key, secret, sandbox: true });

export class GeminiWebhookOrder {
  requestBody: GeminiTradingViewBody;
  tradingViewTicker: string;
  geminiTicker: string;

  constructor(requestBody: GeminiTradingViewBody) {
    this.requestBody = requestBody;
    this.tradingViewTicker = requestBody.ticker;
    this.geminiTicker = this.tradingViewTicker.replace("USDT", "USD");
  }

  async placeOrder() {
    try {
      const accounts = await client.getAccounts();
      console.log(accounts);

      const symbol = this.geminiTicker;
      const account = "primary";
      const client_order_id = `tseitz-${Date.now()}`;
      const amount = 1;
      const price = parseFloat(this.requestBody.strategy.price);
      const side = this.requestBody.strategy.action;
      const type = "exchange limit";
      const order = await client.newOrder({
        symbol,
        client_order_id,
        account,
        amount,
        price,
        side,
        type,
      });

      return order;
    } catch (error) {
      console.log(error);
      return error;
    }
  }
}
