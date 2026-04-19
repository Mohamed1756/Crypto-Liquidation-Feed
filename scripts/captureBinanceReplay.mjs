import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const outputPath = outputArg
  ? outputArg.slice('--output='.length)
  : path.join(process.cwd(), 'data', 'captures', `binance-${new Date().toISOString().slice(0, 10)}.jsonl`);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const stream = fs.createWriteStream(outputPath, { flags: 'a' });
const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

const toBaseAsset = (symbol) => {
  const quoteAssets = ['USDT', 'BUSD', 'BTC', 'ETH', 'USDC'];
  for (const quoteAsset of quoteAssets) {
    if (symbol.endsWith(quoteAsset)) {
      return symbol.slice(0, -quoteAsset.length);
    }
  }
  return symbol;
};

ws.on('open', () => {
  console.log(`Capturing Binance liquidations to ${outputPath}`);
});

ws.on('message', (rawMessage) => {
  try {
    const payload = JSON.parse(rawMessage.toString());
    const forceOrder = payload.o;
    if (!forceOrder) {
      return;
    }

    const quantity = Number.parseFloat(forceOrder.q);
    const price = Number.parseFloat(forceOrder.ap);
    const timestampMs = Number.parseInt(forceOrder.T, 10);

    const event = {
      id: `BINANCE-${forceOrder.s}-${forceOrder.S}-${price}-${quantity}-${timestampMs}`,
      exchange: 'BINANCE',
      symbol: forceOrder.s,
      baseAsset: toBaseAsset(forceOrder.s),
      side: forceOrder.S,
      orderType: forceOrder.o,
      quantity,
      price,
      orderStatus: forceOrder.X,
      timestampMs,
      isoTimestamp: new Date(timestampMs).toISOString(),
      value: quantity * price,
    };

    stream.write(`${JSON.stringify(event)}\n`);
  } catch (error) {
    console.error('Failed to capture Binance liquidation:', error);
  }
});

ws.on('error', (error) => {
  console.error('Capture websocket error:', error);
});

ws.on('close', () => {
  console.log('Capture websocket closed');
  stream.end();
});

process.on('SIGINT', () => {
  console.log('\nStopping capture...');
  ws.close();
  stream.end();
  process.exit(0);
});