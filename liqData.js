const WebSocket = require('ws');
const fs = require('fs');
const { DateTime } = require('luxon');

const websocketUri = 'wss://fstream.binance.com/ws/!forceOrder@arr';
const filename = 'binance.csv';

if (!fs.existsSync(filename)) {
  fs.writeFileSync(
    filename,
    ['Symbol', 'Side', 'Order Type', 'Original Quantity', 'Liq Price', 'Order Status', 'TimeStamp', 'Value'].join(',') + '\n'
  );
}

async function binanceLiquidations(uri, filename) {
  const ws = new WebSocket(uri);

  ws.on('open', () => {
    console.log('WebSocket connected');
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message)['o'];
      const symbol = msg['s'];
      const side = msg['S'];
      const orderType = msg['o'];
      const quantity = parseFloat(msg['q']);
      const averagePrice = parseFloat(msg['ap']);
      const orderStatus = msg['X'];
      const timestamp = parseInt(msg['T']);
      const value = quantity * averagePrice;

      // Convert timestamp to UTC datetime
      const tradeTime = DateTime.fromMillis(timestamp).toUTC().toFormat('HH:mm:ss');

      const data = [
        symbol,
        side,
        orderType,
        quantity.toString(),
        averagePrice.toString(),
        orderStatus,
        tradeTime,
        value.toString(),
      ];

      fs.appendFileSync(filename, data.join(',') + '\n');
    } catch (error) {
      console.error(error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

binanceLiquidations(websocketUri, filename).catch((error) => {
  console.error('An error occurred:', error);
});
