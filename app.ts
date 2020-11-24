import express from 'express';
import Order from './models/Order';
import { KrakenOrder } from './services/krakenService';
import { handleUniswapOrder } from './services/uniswapService';
import { TradingViewBody } from './models/TradingViewBody';
// const Binance = require("node-binance-api");
// const config = require("./config");

const PORT = process.env.PORT || 3000;

const app = express();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_SECRET_KEY,
// });

// create application/json parser
const jsonParser = express.json();
app.use(jsonParser);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

let locked = false;
const queue: TradingViewBody[] = [];
app.post('/webhook/trading-view', jsonParser, async (req, res) => {
  // force body to be JSON
  const requestBody: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.sendStatus(401);
  }

  // ignore close signal for now. Our current strategy flips the order so we handle it below
  // allow to "close only" though, meaning exit current trade without entering a new one
  const description = requestBody.strategy.description.toLowerCase();
  if (description.includes('close') && !description.includes('close only')) {
    console.log('Close order skipped');
    return res.sendStatus(200);
  }

  queue.push(requestBody);

  if (locked === true) {
    return;
  }

  while (queue.length > 0) {
    locked = true;
    const body = queue.shift();
    if (body) {
      const order = new KrakenOrder(body);
      res.send(await order.placeOrder());
    }
    locked = false;
  }
  return res.sendStatus(200);
});

app.post('/webhook/uniswap', jsonParser, async (req, res) => {
  // force body to be JSON
  const requestBody: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.sendStatus(401);
  }

  const blockNumberMined = await handleUniswapOrder(requestBody);
  return res.send(blockNumberMined);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});
