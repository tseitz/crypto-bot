const express = require("express");
var https = require("https");
var bodyParser = require("body-parser");
const Binance = require("node-binance-api");
// const KrakenClient = require("./modules/kraken");
const Kraken = require("kraken-wrapper");

const PORT = process.env.PORT || 3000;

const app = express();

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_SECRET_KEY,
});
const kraken = new Kraken(
  process.env.KRAKEN_API_KEY,
  process.env.KRAKEN_SECRET_KEY
);
const kraken_url = "https://api.kraken.com";

// create application/json parser
var jsonParser = bodyParser.json();
app.use(jsonParser);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/webhook/trading-view", jsonParser, async (req, res) => {
  // force body to be JSON. I haven't tested raw data from TV so not taking the risk
  const body = JSON.parse(JSON.stringify(req.body));
  if (body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log("Hey buddy, get out of here");
    res.sendStatus(401);
    return;
  }
  console.log("Ayyyyy, we got a trade alert!");
  const pair = body.ticker;

  kraken.getTradableAssetPairs({ pair }).then((response) => {
    const orderMin = response.result[pair]["ordermin"];

    kraken
      .getTickerInformation({ pair: "XBTUSD" })
      .then((response) => {
        // grab current btc price (used for usd/btc conversions atm)
        const btcPrice = response.result["XXBTZUSD"]["c"][0];
        console.log(`BTC Price: ${btcPrice}`);

        // grab data from the body
        const action = req.body.strategy.order_action;
        const price = req.body.strategy.order_price; // price of asset

        // if btc pair, convert to dollar (to pay $10 for now)
        // if usdt pair, keep dollar price
        const btcPair = /XBT$/.test(pair); // bitcoin pair, not XBTUSDT
        const priceInDollar = btcPair ? btcPrice * price : price; // convert btc price to dollar price

        // either use $10 or lowest order value (sometimes coins are > $10 equivilant min order)
        let volume = (10 / priceInDollar).toFixed(3); // we want $10
        volume = volume > orderMin ? volume : orderMin;

        const usdValue = (priceInDollar * volume).toFixed(2); // total value bought
        console.log(
          `${action} ${volume} ${pair} at ${price} BTC ($${priceInDollar.toFixed(
            2
          )}) for $${usdValue}`
        );

        kraken
          .setAddOrder({
            pair,
            type: action,
            ordertype: "market",
            volume,
            validate: true,
          })
          .then((response) => {
            console.log(response);
            res.send(response);
          })
          .catch((error) => {
            console.log(error);
          });
      })
      .catch((error) => {
        console.log(error);
      });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});
