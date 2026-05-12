const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  DecodeHintType,
  RGBLuminanceSource,
  BarcodeFormat,
} = require('@zxing/library');

const PREFERRED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

function rotateImageData(data, width, height, rotation) {
  if (!rotation || rotation === 0) return { data, width, height };
  const rotatedWidth = rotation % 180 === 0 ? width : height;
  const rotatedHeight = rotation % 180 === 0 ? height : width;
  const rotated = new Uint8ClampedArray(rotatedWidth * rotatedHeight * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIndex = (y * width + x) * 4;
      let dx = 0;
      let dy = 0;
      switch (rotation) {
        case 90:
          dx = height - 1 - y;
          dy = x;
          break;
        case 180:
          dx = width - 1 - x;
          dy = height - 1 - y;
          break;
        case 270:
          dx = y;
          dy = width - 1 - x;
          break;
        default:
          dx = x;
          dy = y;
      }
      const dstIndex = (dy * rotatedWidth + dx) * 4;
      rotated[dstIndex] = data[srcIndex];
      rotated[dstIndex + 1] = data[srcIndex + 1];
      rotated[dstIndex + 2] = data[srcIndex + 2];
      rotated[dstIndex + 3] = data[srcIndex + 3];
    }
  }
  return { data: rotated, width: rotatedWidth, height: rotatedHeight };
}

function decode(data, width, height) {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, PREFERRED_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  const source = new RGBLuminanceSource(data, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  return reader.decode(bitmap);
}

function tryDecode(filePath) {
  const buffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const rotations = [0, 90, 180, 270];
  for (const rotation of rotations) {
    const rotated = rotateImageData(clamped, width, height, rotation);
    try {
      const result = decode(rotated.data, rotated.width, rotated.height);
      return { rotation, text: result.getText() };
    } catch (err) {
      continue;
    }
  }
  throw new Error('unable to decode');
}

try {
  const target = path.join(__dirname, '..', 'public', 'image0.png');
  const output = tryDecode(target);
  
} catch (err) {
  
  process.exit(1);
}
