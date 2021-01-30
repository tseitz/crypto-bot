import fs from 'fs';
import path from 'path';
const config: any = require('./strategy-params.json'); // casting as any for now
import { ConfigPair } from './types';

const myArgs = process.argv.slice(2);

/*
I built this so I could make a change in the base file, and automatically build the other available strategies
*/
try {
  const inputFile = myArgs[0];
  const pair = myArgs[1];
  const outputFile = myArgs[2];
  const pairConfig: ConfigPair = config[pair];
  console.log(pairConfig);

  let data = fs.readFileSync(path.resolve(__dirname, `${inputFile}.pine`), 'utf8');

  for (const configItem in pairConfig) {
    const value = pairConfig[configItem];
    data = data.replace(`{{config.${configItem}}}`, value.toString());
  }

  fs.writeFileSync(path.resolve(__dirname, `current/${outputFile}.pine`), data);
} catch (err) {
  console.error(err);
}
