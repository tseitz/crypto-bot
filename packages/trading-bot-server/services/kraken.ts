import { URL } from "url";
import * as Path from "path";

import { HttpMethod } from "../models/enums/HttpMethod";
import { KrakenApiVersion } from "../models/enums/KrakenApiVersion";
import { KrakenApiDomain } from "../models/enums/KrakenApiDomain";

export class KrakenApiClient {
  private static BASE_URL: string = 'https://api.kraken.com';
  private static API_KEY: string;
  private static API_SECRET: string;

  /**
   * Initializes a new Binance API client.
   *
   * @param apiKey    The personal account API key.
   * @param apiSecret The personal account API secret.
   */
  constructor(apiKey: string, apiSecret: string) {
    KrakenApiClient.API_KEY = apiKey;
    KrakenApiClient.API_SECRET = apiSecret;
  }

  private async makeRequest(
    httpMethod: HttpMethod,
    apiVersion: KrakenApiVersion,
    domain: KrakenApiDomain,
    resource: string
  ) {
    var signature = '';
    var headers = {};

    headers = {
      'User-Agent': 'Kraken Wrapper Node API Client'
    };
    
    const apiUrl: URL = new URL(
      Path.join("api", apiVersion, domain, resource),
      KrakenApiClient.BASE_URL
    );

    if (domain === KrakenApiDomain.PRIVATE) {
      const nonce = new Date() * 1000;

      paramsSet.nonce = nonce;

      signature = _this.createSignature(path, paramsSet, nonce);

      headers = {
        'API-Key': _this.__apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': _querystring2.default.stringify(paramsSet).length
      };
    }
  }

  private function createSignature(path, params, nonce) {
    var paramsString = _querystring2.default.stringify(params);
    var secret = new Buffer(this.__apiSecret, 'base64');
    var hash = new _crypto2.default.createHash('sha256'); // eslint-disable-line new-cap
    var hmac = new _crypto2.default.createHmac('sha512', secret); // eslint-disable-line new-cap

    var hashDigest = hash.update(nonce + paramsString).digest('binary');
    var signature = hmac.update(path + hashDigest, 'binary').digest('base64');

    return signature;
  }
}
