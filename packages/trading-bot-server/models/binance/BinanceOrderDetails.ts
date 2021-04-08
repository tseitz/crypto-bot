import { KrakenTradingViewBody } from "../TradingViewBody";
import { StrategyParams, StrategyParamsJson } from "../StrategyParams";
import { superParseFloat } from "../../scripts/common";
const strategyParams: StrategyParamsJson = require("../../strategy-params");

type AssetClassTicker = "XBTUSDT" | "ETHUSDT";

interface OrderInfo {
  body: KrakenTradingViewBody;
}

export default class KrakenOrderDetails {
  tradingViewTicker: string;

  constructor({
    body,
  }: OrderInfo) {
    
  }

  private getEntry(): number {
    if (this.shortZone) {
      if (this.positionSize) {
        return this.positionSize * this.shortZoneDeleverage;
      } else {
        return this.strategyParams.entrySize * this.shortZoneDeleverage;
      }
    } else {
      if (this.positionSize) {
        return this.positionSize;
      } else {
        return this.strategyParams.entrySize * this.longZoneDeleverage;
      }
    }
  }

  private getAddSize(): number {
    if (this.shortZone) {
      if (this.positionSize) {
        return this.positionSize * this.shortZoneDeleverage;
      } else {
        // return this.strategyParams.addSize * this.shortZoneDeleverage;
        return 0;
      }
    } else {
      if (this.positionSize) {
        return this.positionSize;
      } else {
        // return this.strategyParams.addSize * this.longZoneDeleverage;
        return 0;
      }
    }
  }

  private getTradeVolume(): number {
    let volume = 0;

    if (this.entrySize) {
      if (this.action === "sell" && this.close) {
        return this.balanceOfBase;
      } else {
        volume = superParseFloat(
          (this.entrySize * (this.leverageAmount || 1)) / this.usdValueOfBase,
          this.volumeDecimals
        );
        return volume > this.minVolume ? volume : this.minVolume;
      }
    } else {
      console.log("No size to enter. Using default. Fix please");
      if (this.action === "sell") {
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

  getOpenOrderDollarAmount(): number {
    const openOrders = this.openOrders?.open;

    let totalAmount = 0;
    if (openOrders) {
      for (const key in openOrders) {
        const type = openOrders[key]["descr"]["type"];

        if (type === "buy") {
          const price = openOrders[key]["descr"]["price"];
          const vol = openOrders[key]["vol"];
          const volExec = openOrders[key]["vol_exec"];
          const leverage = parseInt(openOrders[key]["descr"]["leverage"][0]);

          totalAmount +=
            (parseFloat(price) * (parseFloat(vol) - parseFloat(volExec))) /
            (isNaN(leverage) ? 1 : leverage);
        }
      }
    }

    return totalAmount;
  }

  convertBaseToDollar(base: number, usd: number): number {
    return superParseFloat(base * usd, 2);
  }
}
