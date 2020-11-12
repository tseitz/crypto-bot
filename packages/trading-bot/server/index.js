const express = require("express");
var https = require("https");
var bodyParser = require("body-parser");
// const Binance = require("node-binance-api");
const Kraken = require("kraken-wrapper");
const config = require("./config");

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

  // grab data from the body
  let { action, description, leverage } = body.strategy;
  const oppositeAction = action === "buy" ? "sell" : "buy";
  const tradingViewTicker = body.ticker;
  leverage = leverage || 2;

  // Kraken uses XBT instead of BTC
  const switchPair = /BTC/.test(tradingViewTicker);
  const krakenTicker = switchPair
    ? tradingViewTicker.replace("BTC", "XBT")
    : tradingViewTicker;

  // stopped out. this is handled by config currently
  if (description && description.includes("stop")) {
    console.log("Stopped out handled by Kraken now");
    return res.sendStatus(200);
  }

  // get pair data (used for orderMin, decimal info)
  const {
    error: krakenPairError,
    result: krakenPairResult,
  } = await kraken.getTradableAssetPairs({ pair: krakenTicker });

  if (krakenPairError.length > 0) {
    console.log(`Pair data for ${krakenPair} not available on Kraken`);
    res.sendStatus(401);
    return;
  }

  // Sometimes the kraken name is not what I receive from TradingView
  const krakenPair = Object.keys(krakenPairResult)[0];
  const orderMin = krakenPairResult[krakenPair]["ordermin"];
  const baseOfPair = krakenPairResult[krakenPair]["base"];
  const levarageAvailable =
    krakenPairResult[krakenPair]["leverage_buy"].length > 0;
  const decimals = krakenPairResult[krakenPair]["pair_decimals"];

  const { result: priceInfo } = await kraken.getTickerInformation({
    pair: krakenPair,
  });
  const currentBid = priceInfo[krakenPair]["b"][0];
  // const currentPrice = priceInfo[krakenPair]["c"][0];

  // if btc pair, convert to dollar (to pay $10 for now)
  // if usdt pair, keep dollar price
  const btcPair = /XBT$/.test(krakenPair); // bitcoin pair, not XBTUSDT
  let myBidPriceInDollar;
  if (btcPair) {
    // TODO: doesn't handle ETHXBT
    const { result } = await kraken.getTickerInformation({ pair: "XBTUSDT" });
    const btcPrice = result["XBTUSDT"]["c"][0];
    console.log(`Current BTC Price: ${btcPrice}`);
    myBidPriceInDollar = btcPrice * currentBid;
  } else {
    myBidPriceInDollar = currentBid;
  }

  // either use $10 or lowest order value (sometimes coins are > $10 equivilant min order)
  let volume = (10 / myBidPriceInDollar).toFixed(3);
  volume = volume > orderMin ? volume : orderMin;

  const usdOrderValue = (myBidPriceInDollar * volume).toFixed(2); // total value bought
  console.log(
    `${krakenPair} ${action.toUpperCase()} ${volume} ${baseOfPair} at ${currentBid} : $${usdOrderValue} at $${myBidPriceInDollar}`
  );

  if (description.includes("Close")) {
    if (!levarageAvailable) {
      const {
        error: balanceError,
        result: balanceResult,
      } = await kraken.getBalance();
      // no selling, so can't settle buy. if it's a sell we'll just sell all for now
      if (oppositeAction == "sell") {
        return res.send(200);
      }
      var { error, result } = await kraken.setAddOrder({
        pair: krakenPair,
        type: action,
        ordertype: "market",
        volume: balanceResult[baseOfPair],
        // validate: true,
      });
    } else {
      var { error, result } = await kraken.setAddOrder({
        pair: krakenPair,
        type: action,
        ordertype: "market",
        volume: 0,
        leverage,
        // validate: true,
      });
    }

    console.log("Closing Request: ", error, result);
    return res.send({ error, result });
  }

  const stopLoss =
    action === "buy"
      ? currentBid * (1 - 12 / 100)
      : currentBid * (1 + 12 / 100); // config[krakenPair].longStop

  if (!levarageAvailable) {
    var { error, result } = await kraken.setAddOrder({
      pair: krakenPair,
      type: action,
      ordertype: "stop-loss",
      price: btcPair ? stopLoss.toFixed(decimals) : stopLoss.toFixed(1),
      // price2: currentBid,
      volume,
      // validate: true,
    });
  } else {
    var { error, result } = await kraken.setAddOrder({
      pair: krakenPair,
      type: action,
      ordertype: "stop-loss",
      price: btcPair ? stopLoss.toFixed(decimals) : stopLoss.toFixed(1),
      // price2: currentBid,
      volume,
      leverage,
      // validate: true,
    });
  }

  console.log("Set Order Request: ", error, result);
  return res.send({ error, result }); // idk we'll figure out a better way
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});

async function closePosition() {
  var { error, result: closeOut } = await kraken.setAddOrder({
    pair,
    type: oppositeAction,
    ordertype: "settle-position",
    volume: 0,
    // leverage,
    // validate: true
  });
  console.log(closeOut);
}

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
    order: ['stop-loss', '5%']
  });
}
