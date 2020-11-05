const express = require("express");
var https = require("https");
var bodyParser = require("body-parser");
// const Binance = require("node-binance-api");
const Kraken = require("kraken-wrapper");

const PORT = process.env.PORT || 3000;

const app = express();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_SECRET_KEY,
// });
const kraken = new Kraken(
  process.env.KRAKEN_API_KEY,
  process.env.KRAKEN_SECRET_KEY
);

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

  // grab data from the body
  const pair = body.ticker;
  const action = body.strategy.order_action;
  const assetPrice = body.strategy.order_price; // price of asset in usd or btc

  if (pair === "ETHXBT") {
    xethStrategy(pair, action, assetPrice);
    return;
  }

  // get pair data (used for orderMin)
  const {
    error: pairError,
    result: pairResult,
  } = await kraken.getTradableAssetPairs({ pair });

  if (pairError.length > 0) {
    console.log(`Pair data for ${pair} not available on Kraken`);
    res.sendStatus(401);
    return;
  }
  // fancy way picking out the first object. Sometimes the kraken name is not what I receive from TV
  const krakenPair = Object.keys(pairResult)[0];
  const orderMin = pairResult[krakenPair]["ordermin"];
  const base = pairResult[krakenPair]["base"];

  // if btc pair, convert to dollar (to pay $10 for now)
  // if usdt pair, keep dollar price
  const btcPair = /XBT$/.test(pair); // bitcoin pair, not XBTUSDT
  let assetPriceInDollar;
  if (btcPair) {
    // TODO: doesn't handle ETHXBT
    const { result } = await kraken.getTickerInformation({ pair: "XBTUSDT" });
    const btcPrice = result["XBTUSDT"]["c"][0];
    console.log(`Current BTC Price: ${btcPrice}`);
    assetPriceInDollar = btcPrice * assetPrice;
  } else {
    assetPriceInDollar = assetPrice;
  }

  // either use $10 or lowest order value (sometimes coins are > $10 equivilant min order)
  let volume = (10 / assetPriceInDollar).toFixed(3);
  volume = volume > orderMin ? volume : orderMin;

  const usdOrderValue = (assetPriceInDollar * volume).toFixed(2); // total value bought
  console.log(
    `${pair} ${action.toUpperCase()} ${volume} ${base} at ${assetPrice} : $${usdOrderValue} at $${assetPriceInDollar.toFixed(
      2
    )}`
  );

  const order = await kraken.setAddOrder({
    pair,
    type: action,
    ordertype: "market",
    volume,
    validate: true,
  });

  res.send(order);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});

async function xethStrategy(pair, action, assetPrice) {
  const { result } = await kraken.getTickerInformation({ pair: "XBTUSDT" });
  const btcPrice = result["XBTUSDT"]["c"][0];
  console.log(`Current BTC Price: ${btcPrice}`);
  assetPriceInDollar = btcPrice * assetPrice;
  console.log(assetPrice);
  console.log(assetPriceInDollar);

  let volume;
  if (action == "buy") {
    volume = (50 / assetPriceInDollar).toFixed(3);
  } else {
    volume = (100 / assetPriceInDollar).toFixed(3);
  }
  console.log(volume);

  const order = await kraken.setAddOrder({
    pair,
    type: action,
    ordertype: "market",
    volume,
    validate: true,
  });
}
