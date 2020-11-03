const express = require("express");
var https = require("https");
var bodyParser = require("body-parser");
const Binance = require("node-binance-api");
// const KrakenClient = require("./modules/kraken");
const Kraken = require('kraken-wrapper');

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
app.use(jsonParser)

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/webhook/trading-view", jsonParser, async (req, res) => {
  if (req.body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log("Hey buddy, get out of here");
    res.sendStatus(401);
    return;
  }
  console.log("Ayyyyy, we got a trade alert!");

  kraken
    .getTrades({ pair: "ETHUSD" })
    .then((response) => {
      console.log(response);
    })
    .catch((error) => {
      console.log(error);
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