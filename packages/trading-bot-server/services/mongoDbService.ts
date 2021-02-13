import { MongoClient } from 'mongodb';
import { KrakenTradeBalance } from '../models/kraken/KrakenResults';
import KrakenOrderDetails from '../models/kraken/KrakenOrderDetails';

export const mongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING || '', {
  useUnifiedTopology: true,
});

export async function logNightlyResult(balances: KrakenTradeBalance) {
  try {
    await mongoClient.connect();

    const database = mongoClient.db('balances');
    const collection = database.collection('kraken');

    // console.dir(balances);
    // const logBalance =

    const mongoResult = await collection.insertOne(balances);

    if (mongoResult.insertedCount === 1) {
      console.log('Logged to Mongo');
      // console.dir(mongoResult);
    } else {
      console.log(`Nothing logged to Mongo`);
      // console.dir(mongoResult);
    }
  } finally {
    // Ensures that the mongoClient will close when you finish/error
    await mongoClient.close();
  }
}

// export async function logKrakenResult(order: KrakenOrderDetails, result: KrakenOrderResult) {
//   try {
//     await mongoClient.connect();

//     const database = mongoClient.db('trades');
//     const collection = database.collection('kraken');

//     order.result = result;

//     console.dir(order);

//     const mongoResult = await collection.insertOne(order);

//     if (mongoResult.insertedCount === 1) {
//       console.dir(mongoResult);
//     } else {
//       console.dir(mongoResult);
//     }
//   } finally {
//     // Ensures that the mongoClient will close when you finish/error
//     await mongoClient.close();
//   }
// }
