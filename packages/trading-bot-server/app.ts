import express from 'express';
import schedule from 'node-schedule';
import { KrakenOrder } from './models/kraken/KrakenOrder';
import { kraken } from './services/krakenService';
// import { handleUniswapOrder } from './services/uniswapService';
import { TradingViewBody } from './models/TradingViewBody';
import { OrderQueue } from './models/OrderQueue';
import { MongoClient } from 'mongodb';
// const Binance = require("node-binance-api");
// const config = require("./config");

const PORT = process.env.PORT || 3000;

const mongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING || '');

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
  // console.log('Request Received, Current Queue: ', queue.length);
  // force body to be JSON
  const body: TradingViewBody = JSON.parse(JSON.stringify(req.body));
  if (!body || body.passphrase !== process.env.TRADING_VIEW_PASSPHRASE) {
    console.log('Hey buddy, get out of here', req);
    console.log('-'.repeat(20));
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
      const order = new KrakenOrder(request.body);
      try {
        request.res.send(await order.placeOrder());
      } catch (error) {
        console.log(error);
        locked = false;
      }
    }
    console.log('-'.repeat(20));
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

const cron = schedule.scheduleJob('0 0 * * *', async () => {
  getBalances();
});

async function getBalances() {
  // TODO - make this it's own thing
  // c:'2881.3240'
  // e:'1151.8423'
  // eb:'2052.1541'
  // m:'1095.7655'
  // mf:'56.0768'
  // ml:'105.11'
  // n:'24.1204'
  // tb:'1127.7219'
  // v:'2912.7724'
  const balances = await kraken.kraken.getTradeBalance();

  console.log(`Nightly Log
---------------------------
  Balance: $${balances.result.eb}
  Open:    $${balances.result.n}
  Total:   $${parseFloat(balances.result.eb) + parseFloat(balances.result.n)}
---------------------------`);
}
// getBalances();

async function run() {
  try {
    await mongoClient.connect();
    // const database = mongoClient.db('trades');
    // const collection = database.collection('kraken');
    const database = mongoClient.db('sample_mflix');
    const collection = database.collection('movies');
    // Query for a movie that has the title 'Back to the Future'
    const query = { title: 'Back to the Future' };
    const movie = await collection.findOne(query);
    console.log(movie);
  } finally {
    // Ensures that the mongoClient will close when you finish/error
    await mongoClient.close();
  }
}
run().catch(console.dir);
