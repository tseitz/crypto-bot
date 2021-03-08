import express from 'express';
import schedule from 'node-schedule';
import { KrakenWebhookOrder } from './models/kraken/KrakenWebhookOrder';
import { kraken } from './services/krakenService';
// import { handleUniswapOrder } from './services/uniswapService';
import { TradingViewBody } from './models/TradingViewBody';
import { OrderQueue } from './models/OrderQueue';
import { mongoClient, logNightlyResult } from './services/mongoDbService';
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

const queue: OrderQueue[] = [];
let locked = false;

app.post('/webhook/kraken', jsonParser, async (req, res) => {
  // force body to be JSON
  const body: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!body || body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here', req);
    console.log('-'.repeat(26));
    return res.send('Hey buddy, get out of here');
  }

  // queue it
  queue.push({ body, res });
  if (locked === true) return;

  while (queue.length > 0) {
    locked = true;
    const request = queue.shift();
    if (request) {
      console.log(
        request.body.ticker,
        request.body.strategy.action,
        request.body.strategy.description
      );
      const order = new KrakenWebhookOrder(request.body);
      try {
        request.res.send(await order.placeOrder());
      } catch (error) {
        console.log(error);
        locked = false;
      }
    }
    console.log('-'.repeat(26));
    locked = false;
  }
  return;
});

// app.post('/webhook/uniswap', jsonParser, async (req, res) => {
//   // force body to be JSON
//   const requestBody: TradingViewBody = JSON.parse(JSON.stringify(req.body));
//   if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
//     console.log('Hey buddy, get out of here');
//     return res.send('Hey buddy, get out of here');
//   }

//   const blockNumberMined = await handleUniswapOrder(requestBody);
//   return res.send(blockNumberMined);
// });

app.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${PORT}`);
  if (PORT === 3000) {
    console.log(`Here ya go http://localhost:${PORT}`);
  } else {
    console.log(`Hi Heroku`);
  }
});

const cronNoon = schedule.scheduleJob('0 12 * * *', async () => {
  getBalances();
});
const cronMidnight = schedule.scheduleJob('0 0 * * *', async () => {
  getBalances();
});

async function getBalances() {
  const { balances } = await kraken.getTradeBalance();
  const realizedBalance = balances.totalBalances;
  const unrealizedGains = balances.unrealizedGains;
  const unrealizedBalance = parseFloat(realizedBalance) + parseFloat(unrealizedGains);

  console.log(`Nightly Log
--------------------------
  Balance:      $${realizedBalance}
  Open:         $${unrealizedGains}
  Unrealized:   $${unrealizedBalance.toFixed(4)}
--------------------------`);

  await logNightlyResult(balances);
}
// getBalances();
