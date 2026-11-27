# Auvori AI Model & Runtime Attribution

All AI inference executes **100% locally in the user's browser inside a Web Worker** via ONNX Runtime Web (`onnxruntime-web@1.31.1`, MIT License). No user images or derived tensors are ever transmitted to external servers. Models are lazy-loaded on demand and cached offline via Cache Storage (`auvori-ai-models-v1`).

## 1. YuNet Face Detection (`face_detection_yunet_2026may.onnx`)

- **Role**: Stage A — multi-face bounding box + 5-point facial landmark detection (right eye, left eye, nose tip, right mouth corner, left mouth corner).
- **Upstream Repository**: [`opencv/opencv_zoo`](https://github.com/opencv/opencv_zoo/tree/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/face_detection_yunet)
- **Pinned Commit**: `eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4`
- **Exact Download URL**: `https://media.githubusercontent.com/media/opencv/opencv_zoo/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/face_detection_yunet/face_detection_yunet_2026may.onnx`
- **File Size**: `229,738` bytes (`0.219 MiB`)
- **SHA-256**: `ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0`
- **License**: MIT License — `Copyright (c) 2020 Shiqi Yu`
- **ONNX Format**: IR v6, Opset 11 (`Add, Conv, MaxPool, Relu, Reshape, Resize, Sigmoid, Transpose`)
- **Input Tensor**: `'input'` — `float32[1, 3, padH, padW]`, BGR channel order, raw `[0..255]` float values, resized aspect-preserving up to `maxSide=640`, bottom/right zero-padded to multiples of 32.
- **Output Tensors**: `cls_8`, `cls_16`, `cls_32` (`[1, N, 1]`), `obj_8`, `obj_16`, `obj_32` (`[1, N, 1]`), `bbox_8`, `bbox_16`, `bbox_32` (`[1, N, 4]`), `kps_8`, `kps_16`, `kps_32` (`[1, N, 10]`). Decoded per OpenCV `face_detect.cpp` with calibrated `scoreThreshold = 0.80` + landmark geometry validation + IoU NMS (`0.30`).

## 2. PP-HumanSeg V2-Lite (`human_segmentation_pphumanseg_2023mar.onnx`)

- **Role**: Stage B (Primary Portrait Subject Segmentation when faces are detected) — human torso/head/hijab/dark-clothing/multi-subject segmentation. Evaluated empirically against `u2netp.onnx` and `Xenova/modnet` across 14 unedited photographs; provides cleaner dark-clothing (`low_light_portrait.jpg`), white-on-white clothing (`button_up_portrait.jpg`), multi-subject (`multiple_faces.jpg`), and landscape rejection (`0.3%` vs `10.0%`) at ~15× lower CPU latency.
- **Upstream Repository**: [`opencv/opencv_zoo`](https://github.com/opencv/opencv_zoo/tree/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/human_segmentation_pphumanseg) (ported from PaddlePaddle/PaddleSeg)
- **Pinned Commit**: `eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4`
- **Exact Download URL**: `https://media.githubusercontent.com/media/opencv/opencv_zoo/eb9f4f2d4b79b58e5513b5d25d5f0243a8357bf4/models/human_segmentation_pphumanseg/human_segmentation_pphumanseg_2023mar.onnx`
- **File Size**: `6,163,938` bytes (`5.88 MiB`)
- **SHA-256**: `552d8a984054e59b5d773d24b9b12022b22046ceb2bbc4c9aaeaceb36a9ddf24`
- **License**: Apache License 2.0 — `Copyright (c) 2021 PaddlePaddle Authors. All Rights Reserved` / OpenCV Zoo Notice (`Copyright (C) 2021, Shenzhen Institute of Artificial Intelligence and Robotics for Society`)
- **ONNX Format**: IR v8, Opset 11 (`Add, Concat, Conv, Relu, Resize, Softmax, Transpose`)
- **Input Tensor**: `'x'` — `float32[1, 3, 192, 192]`, RGB channel order, normalized `(px / 255.0 - 0.5) / 0.5`.
- **Output Tensor**: `'save_infer_model/scale_0.tmp_1'` — `float32[1, 2, 192, 192]` normalized softmax probabilities (`channel 0 = background`, `channel 1 = foreground`).

## 3. U²-Netp (`u2netp.onnx`)

- **Role**: Stage B (General Salient-Object Segmentation when no frontal face is detected or when `segmentationModel: 'u2netp'` is requested) — handles non-human objects (coffee cup, tabletop scenes) and non-frontal figures (`beach_portrait.jpg`) with `320×320` edge precision. Treated strictly as general salient-object segmentation (not portrait hair matting), gated in Stage C against empty landscapes (`landscape_lake.jpg`).
- **Upstream Source**: [`danielgatis/rembg`](https://github.com/danielgatis/rembg/releases/tag/v0.0.0) / [`xuebinqin/U-2-Net`](https://github.com/xuebinqin/U-2-Net/tree/ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29)
- **Pinned Commit / Release**: `v0.0.0` (`ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29`)
- **Exact Download URL**: `https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx`
- **File Size**: `4,574,861` bytes (`4.36 MiB`)
- **SHA-256**: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
- **License**: Apache License 2.0 — `Copyright 2020 Xuebin Qin`
- **ONNX Format**: IR v6, Opset 11 (`Add, Cast, Concat, Constant, Conv, Gather, MaxPool, Relu, Resize, Shape, Sigmoid, Slice, Unsqueeze`)
- **Input Tensor**: `'input.1'` — `float32[1, 3, 320, 320]`, RGB channel order, scaled by `max(maxPixel, 1e-6)` and normalized with ImageNet `mean = [0.485, 0.456, 0.406]`, `std = [0.229, 0.224, 0.225]`.
- **Output Tensor**: `'1959'` — `float32[1, 1, 320, 320]` primary saliency probability map `[0..1]`.
