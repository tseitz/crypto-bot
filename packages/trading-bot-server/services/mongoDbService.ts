import { MongoClient } from 'mongodb';
import { KrakenOrderResult } from '../models/kraken/KrakenResults';
import KrakenOrderDetails from '../models/kraken/KrakenOrderDetails';

// export const mongoClient = new MongoClient(process.env.MONGO_CONNECTION_STRING || '', {
//   useUnifiedTopology: true,
// });

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
