import fs from 'node:fs/promises';
import path from 'node:path';
import { buildReplayDataset, isReplayDataset, type ReplayDataset } from '../src/ml/replayDataset.ts';
import type { MinuteVectorEvent } from '../src/ml/minuteVectors.ts';

interface CliOptions {
  input: string;
  output: string;
  source: string;
  assumeDate?: string;
}

const DEFAULT_OUTPUT = path.join(process.cwd(), 'public', 'replay', 'liquidation-replay-dataset.json');

const parseArgs = (): CliOptions => {
  const options: Partial<CliOptions> = {
    output: DEFAULT_OUTPUT,
    source: 'manual-import',
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--input=')) options.input = arg.slice('--input='.length);
    if (arg.startsWith('--output=')) options.output = arg.slice('--output='.length);
    if (arg.startsWith('--source=')) options.source = arg.slice('--source='.length);
    if (arg.startsWith('--assume-date=')) options.assumeDate = arg.slice('--assume-date='.length);
  }

  if (!options.input || !options.output || !options.source) {
    throw new Error('Usage: replay:build --input=<file> [--output=<file>] [--source=<name>] [--assume-date=YYYY-MM-DD]');
  }

  return options as CliOptions;
};

const toBaseAsset = (symbol: string) => {
  const quoteAssets = ['USDT', 'BUSD', 'BTC', 'ETH', 'USDC'];
  for (const quoteAsset of quoteAssets) {
    if (symbol.endsWith(quoteAsset)) {
      return symbol.slice(0, -quoteAsset.length);
    }
  }
  return symbol;
};

const parseLegacyTimestamp = (rawTimestamp: string, assumeDate?: string) => {
  if (/^\d+$/.test(rawTimestamp)) {
    const timestampMs = Number.parseInt(rawTimestamp, 10);
    return {
      timestampMs,
      isoTimestamp: new Date(timestampMs).toISOString(),
    };
  }

  if (rawTimestamp.includes('T')) {
    const timestampMs = Date.parse(rawTimestamp);
    return {
      timestampMs,
      isoTimestamp: new Date(timestampMs).toISOString(),
    };
  }

  if (!assumeDate) {
    throw new Error('Legacy CSV time-only rows require --assume-date=YYYY-MM-DD');
  }

  const timestampMs = Date.parse(`${assumeDate}T${rawTimestamp}Z`);
  return {
    timestampMs,
    isoTimestamp: new Date(timestampMs).toISOString(),
  };
};

const parseCsv = (content: string, assumeDate?: string): MinuteVectorEvent[] => {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(',').map((value) => value.trim());
  const events: MinuteVectorEvent[] = [];

  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    if (cells.length < header.length) {
      continue;
    }

    const row = Object.fromEntries(header.map((column, index) => [column, cells[index]?.trim() || '']));
    const symbol = row.Symbol || row.symbol;
    if (!symbol) {
      continue;
    }

    const { timestampMs, isoTimestamp } = parseLegacyTimestamp(row.TimeStamp || row.timestamp || row.TimestampMs || row.TimestampIso, assumeDate);
    const quantity = Number.parseFloat(row['Original Quantity'] || row.quantity || '0');
    const price = Number.parseFloat(row['Liq Price'] || row.price || '0');
    const value = Number.parseFloat(row.Value || row.value || String(quantity * price));
    const side = (row.Side || row.side || 'SELL') as 'BUY' | 'SELL';
    const exchange = row.Exchange || row.exchange || 'BINANCE';

    events.push({
      id: `${exchange}-${symbol}-${side}-${price}-${quantity}-${timestampMs}`,
      exchange,
      symbol,
      baseAsset: row.baseAsset || toBaseAsset(symbol),
      side,
      orderType: row['Order Type'] || row.orderType || 'LIMIT',
      quantity,
      price,
      orderStatus: row['Order Status'] || row.orderStatus || 'FILLED',
      timestampMs,
      isoTimestamp,
      value,
    });
  }

  return events;
};

const parseJsonl = (content: string): MinuteVectorEvent[] => {
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MinuteVectorEvent);
};

const parseInput = async (inputPath: string, assumeDate?: string): Promise<ReplayDataset> => {
  const content = await fs.readFile(inputPath, 'utf8');
  const extension = path.extname(inputPath).toLowerCase();

  if (extension === '.json') {
    const parsed = JSON.parse(content) as unknown;
    if (isReplayDataset(parsed)) {
      return buildReplayDataset(parsed.events, parsed.source, parsed.metadata);
    }

    if (Array.isArray(parsed)) {
      return buildReplayDataset(parsed as MinuteVectorEvent[], 'json-array');
    }

    throw new Error('Unsupported JSON input. Expected ReplayDataset or MinuteVectorEvent[].');
  }

  if (extension === '.jsonl') {
    return buildReplayDataset(parseJsonl(content), 'jsonl-capture');
  }

  if (extension === '.csv') {
    return buildReplayDataset(parseCsv(content, assumeDate), 'legacy-csv');
  }

  throw new Error(`Unsupported input type: ${extension}`);
};

const main = async () => {
  const options = parseArgs();
  const dataset = await parseInput(options.input, options.assumeDate);
  const replayDataset = buildReplayDataset(dataset.events, options.source, dataset.metadata);

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, JSON.stringify(replayDataset, null, 2));

  console.log(`Wrote replay dataset to ${options.output}`);
  console.log(`Events: ${replayDataset.eventCount}`);
  console.log(`Minutes: ${replayDataset.minuteCount}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});