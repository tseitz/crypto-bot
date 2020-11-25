import express from 'express';
import schedule from 'node-schedule';
import { KrakenOrder } from './models/kraken/KrakenOrder';
import { kraken } from './services/krakenService';
import { handleUniswapOrder } from './services/uniswapService';
import { TradingViewBody } from './models/TradingViewBody';
import { OrderQueue } from './models/OrderQueue';
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
  console.log('Request Received, Current Queue: ', queue);
  // force body to be JSON
  const requestBody: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.send('Hey buddy, get out of here');
  }

  // ignore close signal for now. Our current strategy flips the order so we handle it below
  // allow "close only" though, meaning exit current trade without entering a new one
  const description = requestBody.strategy.description.toLowerCase();
  if (description.includes('close') && !description.includes('close only')) {
    console.log('Close order skipped');
    return res.send('Close order skipped');
  }

  // queue it
  queue.push({ body: requestBody, res });

  if (locked === true) {
    console.log('Locked, please hold.');
    return res.send('Locked, please hold.');
  }

  while (queue.length > 0) {
    locked = true;
    console.log('Length of Queue Before: ', queue.length);
    const request = queue.shift();
    if (request) {
      const order = new KrakenOrder(request.body);
      request.res.send(await order.placeOrder());
      console.log('Length of Queue After: ', queue.length);
    }
    locked = false;
  }
  return;
});

app.post('/webhook/uniswap', jsonParser, async (req, res) => {
  // force body to be JSON
  const requestBody: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!requestBody || requestBody.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here');
    return res.send('Hey buddy, get out of here');
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

const cron = schedule.scheduleJob('0 0 * * *', async () => {
  const balances = await kraken.kraken.getTradeBalance();

  console.log(`Nightly Log
---------------------------
  Balance: $${balances.result.eb}
  Open:    $${balances.result.n}
  Total:   $${Number.parseFloat(balances.result.eb) + Number.parseFloat(balances.result.n)}
---------------------------`);
});

// async function getBalances() {
//   // TODO - make this it's own thing
//   // c:'2881.3240'
//   // e:'1151.8423'
//   // eb:'2052.1541'
//   // m:'1095.7655'
//   // mf:'56.0768'
//   // ml:'105.11'
//   // n:'24.1204'
//   // tb:'1127.7219'
//   // v:'2912.7724'
//   const balances = await kraken.kraken.getTradeBalance();

//   console.log(`Nightly Log
// ---------------------------
//   Balance: $${balances.result.eb}
//   Open:    $${balances.result.n}
//   Total:   $${Number.parseFloat(balances.result.eb) + Number.parseFloat(balances.result.n)}
// ---------------------------`);
// }

// getBalances();
