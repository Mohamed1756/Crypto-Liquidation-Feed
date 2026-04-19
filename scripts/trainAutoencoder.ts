import fs from 'node:fs/promises';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import {
  buildManifestFromModel,
  computeMeanStd,
  computePercentile,
  createAutoencoderModel,
  createNormalizationStats,
  normalizeMatrix,
} from '../src/ml/autoencoder.ts';
import { isReplayDataset } from '../src/ml/replayDataset.ts';

interface CliOptions {
  input: string;
  output: string;
  epochs: number;
}

const DEFAULT_OUTPUT = path.join(process.cwd(), 'public', 'ml', 'liquidation-autoencoder.json');

const parseArgs = (): CliOptions => {
  const options: CliOptions = {
    input: path.join(process.cwd(), 'public', 'replay', 'liquidation-replay-dataset.json'),
    output: DEFAULT_OUTPUT,
    epochs: 75,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--input=')) options.input = arg.slice('--input='.length);
    if (arg.startsWith('--output=')) options.output = arg.slice('--output='.length);
    if (arg.startsWith('--epochs=')) options.epochs = Number.parseInt(arg.slice('--epochs='.length), 10);
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  const rawDataset = JSON.parse(await fs.readFile(options.input, 'utf8')) as unknown;

  if (!isReplayDataset(rawDataset)) {
    throw new Error('Training input must be a ReplayDataset JSON file.');
  }

  const matrix = rawDataset.minuteVectors.map((row) => row.vector);
  if (matrix.length < 24) {
    throw new Error(`Need at least 24 minute vectors to train the autoencoder. Found ${matrix.length}.`);
  }

  await tf.ready();

  const normalization = createNormalizationStats(matrix);
  const normalizedMatrix = normalizeMatrix(matrix, normalization);
  const tensor = tf.tensor2d(normalizedMatrix);
  const model = createAutoencoderModel(matrix[0].length);

  const batchSize = Math.max(4, Math.min(32, Math.floor(matrix.length / 4)));
  const validationSplit = matrix.length >= 40 ? 0.2 : 0.1;
  const history = await model.fit(tensor, tensor, {
    epochs: options.epochs,
    batchSize,
    shuffle: true,
    validationSplit,
    verbose: 0,
  });

  const reconstructed = model.predict(tensor) as tf.Tensor;
  const reconstructedMatrix = await reconstructed.array() as number[][];
  const errors = normalizedMatrix.map((row, index) => {
    let total = 0;
    for (let featureIndex = 0; featureIndex < row.length; featureIndex += 1) {
      total += Math.pow(row[featureIndex] - reconstructedMatrix[index][featureIndex], 2);
    }
    return total / row.length;
  });

  const threshold = computePercentile(errors, 95);
  const finalLoss = Number(history.history.loss.at(-1) || 0);
  const validationLoss = history.history.val_loss?.length
    ? Number(history.history.val_loss.at(-1) || 0)
    : null;
  const { mean, stdDev } = computeMeanStd(errors);

  const manifest = await buildManifestFromModel({
    model,
    threshold,
    normalization,
    errors,
    sampleCount: matrix.length,
    epochs: options.epochs,
    finalLoss,
    validationLoss,
  });

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, JSON.stringify(manifest, null, 2));

  reconstructed.dispose();
  tensor.dispose();

  console.log(`Wrote autoencoder manifest to ${options.output}`);
  console.log(`Samples: ${matrix.length}`);
  console.log(`Threshold: ${threshold.toFixed(6)}`);
  console.log(`Mean training error: ${mean.toFixed(6)} ± ${stdDev.toFixed(6)}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});