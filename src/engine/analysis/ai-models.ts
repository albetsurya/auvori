/**
 * Pinned AI model manifest, Cache Storage persistence ('auvori-ai-models-v1'),
 * and SHA-256 byte integrity verification for ONNX Runtime Web assets.
 */

import type { AiModelId, AiModelSpec } from './analysis-types';

export const MODEL_CACHE_NAME = 'auvori-ai-models-v1';

export const AI_MODEL_MANIFEST: Readonly<Record<AiModelId, AiModelSpec>> = {
  'yunet-2026may': {
    id: 'yunet-2026may',
    displayName: 'YuNet Face Detection (2026may)',
    url: '/models/face_detection_yunet_2026may.onnx',
    upstreamUrl:
      'https://media.githubusercontent.com/media/opencv/opencv_zoo/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/face_detection_yunet/face_detection_yunet_2026may.onnx',
    version: '2026may',
    pinnedCommit: 'eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4',
    fileSizeBytes: 229738,
    sha256: 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0',
    license: 'MIT License (Copyright (c) 2020 Shiqi Yu)',
    attribution: 'OpenCV Zoo / YuNet (opencv/opencv_zoo)',
    inputName: 'input',
    outputNames: [
      'cls_8', 'cls_16', 'cls_32',
      'obj_8', 'obj_16', 'obj_32',
      'bbox_8', 'bbox_16', 'bbox_32',
      'kps_8', 'kps_16', 'kps_32',
    ],
    supportedOperators: ['Add', 'Conv', 'MaxPool', 'Relu', 'Reshape', 'Resize', 'Sigmoid', 'Transpose'],
  },
  'pphumanseg-2023mar': {
    id: 'pphumanseg-2023mar',
    displayName: 'PP-HumanSeg V2-Lite (2023mar)',
    url: '/models/human_segmentation_pphumanseg_2023mar.onnx',
    upstreamUrl:
      'https://media.githubusercontent.com/media/opencv/opencv_zoo/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/human_segmentation_pphumanseg/human_segmentation_pphumanseg_2023mar.onnx',
    version: '2023mar',
    pinnedCommit: 'eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4',
    fileSizeBytes: 6163938,
    sha256: '552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24',
    license: 'Apache License 2.0 (Copyright (c) 2021 PaddlePaddle Authors / OpenCV Zoo)',
    attribution: 'PaddleSeg PP-HumanSeg via OpenCV Zoo',
    inputName: 'x',
    outputNames: ['save_infer_model/scale_0.tmp_1'],
    supportedOperators: ['Add', 'Concat', 'Conv', 'Relu', 'Resize', 'Softmax', 'Transpose'],
  },
  'u2netp-v1': {
    id: 'u2netp-v1',
    displayName: 'U²-Netp Salient Object Segmentation',
    url: '/models/u2netp.onnx',
    upstreamUrl: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    version: 'v0.0.0',
    pinnedCommit: 'ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29',
    fileSizeBytes: 4574861,
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    license: 'Apache License 2.0 (Copyright 2020 Xuebin Qin)',
    attribution: 'xuebinqin/U-2-Net via danielgatis/rembg',
    inputName: 'input.1',
    outputNames: ['1959'],
    supportedOperators: [
      'Add', 'Cast', 'Concat', 'Constant', 'Conv', 'Gather',
      'MaxPool', 'Relu', 'Resize', 'Shape', 'Sigmoid', 'Slice', 'Unsqueeze',
    ],
  },
};

export class AiModelLoadError extends Error {
  constructor(
    public readonly modelId: AiModelId,
    public readonly reason: 'network-error' | 'size-mismatch' | 'checksum-mismatch' | 'aborted',
    message: string,
  ) {
    super(message);
    this.name = 'AiModelLoadError';
  }
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function verifyModelBytes(spec: AiModelSpec, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength !== spec.fileSizeBytes) {
    throw new AiModelLoadError(
      spec.id,
      'size-mismatch',
      `Model ${spec.id} size mismatch: expected ${spec.fileSizeBytes} bytes, got ${bytes.byteLength}`,
    );
  }
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    const hex = bytesToHex(digest);
    if (hex !== spec.sha256) {
      throw new AiModelLoadError(
        spec.id,
        'checksum-mismatch',
        `Model ${spec.id} SHA-256 mismatch: expected ${spec.sha256}, got ${hex}`,
      );
    }
  }
}

export async function loadVerifiedModelBytes(
  modelId: AiModelId,
  options: { cacheName?: string; signal?: AbortSignal } = {},
): Promise<{ bytes: Uint8Array; fromCache: boolean }> {
  const spec = AI_MODEL_MANIFEST[modelId];
  const cacheName = options.cacheName ?? MODEL_CACHE_NAME;

  if (options.signal?.aborted) {
    throw new AiModelLoadError(modelId, 'aborted', `Model load aborted for ${modelId}`);
  }

  let cache: Cache | null = null;
  if (typeof caches !== 'undefined') {
    try {
      cache = await caches.open(cacheName);
      const cached = await cache.match(spec.url);
      if (cached) {
        const cachedBytes = new Uint8Array(await cached.arrayBuffer());
        try {
          await verifyModelBytes(spec, cachedBytes);
          return { bytes: cachedBytes, fromCache: true };
        } catch {
          await cache.delete(spec.url).catch(() => undefined);
        }
      }
    } catch {
      cache = null;
    }
  }

  let response: Response;
  try {
    response = await fetch(spec.url, { signal: options.signal });
  } catch (err) {
    if (options.signal?.aborted) {
      throw new AiModelLoadError(modelId, 'aborted', `Model fetch aborted for ${modelId}`);
    }
    throw new AiModelLoadError(
      modelId,
      'network-error',
      `Network error fetching ${spec.url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new AiModelLoadError(
      modelId,
      'network-error',
      `HTTP ${response.status} fetching ${spec.url}`,
    );
  }

  const downloaded = new Uint8Array(await response.arrayBuffer());
  await verifyModelBytes(spec, downloaded);

  if (cache) {
    try {
      const cacheCopy = new Uint8Array(downloaded);
      await cache.put(
        spec.url,
        new Response(cacheCopy, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Auvori-Model-Version': spec.version,
            'X-Auvori-Model-Sha256': spec.sha256,
          },
        }),
      );
    } catch {
      // Cache persistence is best-effort (e.g. private browsing quota); verified bytes remain usable.
    }
  }

  return { bytes: downloaded, fromCache: false };
}
