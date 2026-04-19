import * as tf from '@tensorflow/tfjs';
import {
  MINUTE_FEATURE_KEYS,
  vectorToArray,
  type MinuteFeatureKey,
  type MinuteFeatureVector,
} from './minuteVectors.ts';

export interface NormalizationStats {
  mean: number[];
  stdDev: number[];
}

export interface AutoencoderWeightSpec {
  shape: number[];
  values: number[];
}

export interface LiquidationAutoencoderManifest {
  version: number;
  createdAt: string;
  featureKeys: MinuteFeatureKey[];
  hiddenUnits: number[];
  threshold: number;
  normalization: NormalizationStats;
  weights: AutoencoderWeightSpec[];
  training: {
    sampleCount: number;
    epochs: number;
    finalLoss: number;
    validationLoss: number | null;
    meanError: number;
    stdError: number;
  };
}

export interface AutoencoderScore {
  reconstructionError: number;
  threshold: number;
  anomalyPercent: number;
}

const DEFAULT_HIDDEN_UNITS = [8, 4];
const MODEL_PATH = '/ml/liquidation-autoencoder.json';

let runtime:
  | {
      manifest: LiquidationAutoencoderManifest;
      model: tf.Sequential;
    }
  | null = null;
let loadPromise: Promise<boolean> | null = null;

export const computePercentile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentile / 100) * (sorted.length - 1))));
  return sorted[index];
};

export const computeMeanStd = (values: number[]) => {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return {
    mean,
    stdDev: Math.sqrt(variance),
  };
};

export const createNormalizationStats = (matrix: number[][]): NormalizationStats => {
  const featureCount = matrix[0]?.length || 0;
  const mean: number[] = [];
  const stdDev: number[] = [];

  for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
    const column = matrix.map((row) => row[featureIndex]);
    const stats = computeMeanStd(column);
    mean.push(stats.mean);
    stdDev.push(stats.stdDev || 1);
  }

  return { mean, stdDev };
};

export const normalizeVector = (vector: number[], normalization: NormalizationStats) => {
  return vector.map((value, index) => {
    const divisor = normalization.stdDev[index] || 1;
    return (value - normalization.mean[index]) / divisor;
  });
};

export const normalizeMatrix = (matrix: number[][], normalization: NormalizationStats) => {
  return matrix.map((vector) => normalizeVector(vector, normalization));
};

export const calculateReconstructionError = (input: number[], output: number[]) => {
  if (input.length === 0) {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < input.length; index += 1) {
    total += Math.pow(input[index] - output[index], 2);
  }

  return total / input.length;
};

export const createAutoencoderModel = (
  inputSize: number,
  hiddenUnits: number[] = DEFAULT_HIDDEN_UNITS,
) => {
  const [encoderUnits, bottleneckUnits] = hiddenUnits;
  const model = tf.sequential();

  model.add(tf.layers.dense({ inputShape: [inputSize], units: encoderUnits, activation: 'relu' }));
  model.add(tf.layers.dense({ units: bottleneckUnits, activation: 'relu' }));
  model.add(tf.layers.dense({ units: encoderUnits, activation: 'relu' }));
  model.add(tf.layers.dense({ units: inputSize, activation: 'linear' }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

  return model;
};

export const serializeWeights = async (model: tf.LayersModel): Promise<AutoencoderWeightSpec[]> => {
  return Promise.all(model.getWeights().map(async (weight) => ({
    shape: weight.shape,
    values: Array.from(await weight.data()),
  })));
};

export const buildManifestFromModel = async (options: {
  model: tf.LayersModel;
  hiddenUnits?: number[];
  threshold: number;
  normalization: NormalizationStats;
  errors: number[];
  sampleCount: number;
  epochs: number;
  finalLoss: number;
  validationLoss: number | null;
}): Promise<LiquidationAutoencoderManifest> => {
  const { mean, stdDev } = computeMeanStd(options.errors);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    featureKeys: [...MINUTE_FEATURE_KEYS],
    hiddenUnits: options.hiddenUnits || DEFAULT_HIDDEN_UNITS,
    threshold: options.threshold,
    normalization: options.normalization,
    weights: await serializeWeights(options.model),
    training: {
      sampleCount: options.sampleCount,
      epochs: options.epochs,
      finalLoss: options.finalLoss,
      validationLoss: options.validationLoss,
      meanError: mean,
      stdError: stdDev,
    },
  };
};

const setRuntimeFromManifest = async (manifest: LiquidationAutoencoderManifest) => {
  await tf.ready();
  const model = createAutoencoderModel(manifest.featureKeys.length, manifest.hiddenUnits);
  const weights = manifest.weights.map((weight) => tf.tensor(weight.values, weight.shape));
  model.setWeights(weights);
  runtime = { manifest, model };
  weights.forEach((weight) => weight.dispose());
};

export const loadLiquidationAutoencoder = async (path = MODEL_PATH) => {
  if (runtime) {
    return true;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        return false;
      }

      const manifest = await response.json() as LiquidationAutoencoderManifest;
      await setRuntimeFromManifest(manifest);
      return true;
    } catch {
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
};

export const isLiquidationAutoencoderLoaded = () => runtime !== null;

export const scoreMinuteFeatureVector = (featureVector: MinuteFeatureVector): AutoencoderScore | null => {
  if (!runtime) {
    return null;
  }

  const vector = vectorToArray(featureVector);
  const normalized = normalizeVector(vector, runtime.manifest.normalization);

  const result = tf.tidy(() => {
    const inputTensor = tf.tensor2d([normalized]);
    const outputTensor = runtime!.model.predict(inputTensor) as tf.Tensor;
    const reconstructed = Array.from(outputTensor.dataSync());
    const reconstructionError = calculateReconstructionError(normalized, reconstructed);
    const anomalyPercent = Math.min(100, Math.round((reconstructionError / runtime!.manifest.threshold) * 100));

    return {
      reconstructionError,
      threshold: runtime!.manifest.threshold,
      anomalyPercent,
    };
  });

  return result;
};