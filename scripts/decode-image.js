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

// Preferred barcode formats to try first. Limiting formats can speed up decoding.
const PREFERRED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

// Rotate raw RGBA pixel data by 0/90/180/270 degrees.
function rotateImageData(data, width, height, rotation) {
  if (!rotation || rotation === 0) return { data, width, height };

  // rotatedWidth/Height swap for 90/270-degree rotations
  const rotatedWidth = rotation % 180 === 0 ? width : height;
  const rotatedHeight = rotation % 180 === 0 ? height : width;

  // Create a new buffer for RGBA bytes
  const rotated = new Uint8ClampedArray(rotatedWidth * rotatedHeight * 4);

  // Walk each pixel from the source and place it in the rotated buffer
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcIndex = (y * width + x) * 4; // source RGBA index
      let dx = 0;
      let dy = 0;
      // Compute destination coords depending on desired rotation
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
      const dstIndex = (dy * rotatedWidth + dx) * 4; // destination RGBA index
      // copy RGBA bytes
      rotated[dstIndex] = data[srcIndex];
      rotated[dstIndex + 1] = data[srcIndex + 1];
      rotated[dstIndex + 2] = data[srcIndex + 2];
      rotated[dstIndex + 3] = data[srcIndex + 3];
    }
  }

  return { data: rotated, width: rotatedWidth, height: rotatedHeight };
}

// Decode raw RGBA pixel data into a barcode/QR code string using ZXing.
function decode(data, width, height) {
  const hints = new Map();
  // Limit decoder to these preferred formats for faster/accurate decoding
  hints.set(DecodeHintType.POSSIBLE_FORMATS, PREFERRED_FORMATS);
  // Instruct the decoder to spend more time/effort if needed
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  // Create a luminance source from the RGB pixels and convert to a binary bitmap
  const source = new RGBLuminanceSource(data, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));

  // Attempt to decode and return the ZXing result object (throws on failure)
  return reader.decode(bitmap);
}

// High-level helper: read a PNG file and attempt decoding at multiple rotations.
// Returns an object { rotation, text } on success, or throws if none succeed.
function tryDecode(filePath) {
  // Read the PNG file into a buffer
  const buffer = fs.readFileSync(filePath);
  // Use pngjs to synchronously parse PNG and extract raw pixel data (RGBA)
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;

  // Create a typed view for the raw bytes compatible with the decoder
  const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  // Some images may be rotated; try the common orientations
  const rotations = [0, 90, 180, 270];
  for (const rotation of rotations) {
    const rotated = rotateImageData(clamped, width, height, rotation);
    try {
      // decode() throws if it can't find a barcode in this orientation
      const result = decode(rotated.data, rotated.width, rotated.height);
      // On success, return the rotation used and the decoded text
      return { rotation, text: result.getText() };
    } catch (err) {
      // ignore and try the next rotation
      continue;
    }
  }

  // None of the rotations worked
  throw new Error('unable to decode');
}

try {
  const target = path.join(__dirname, '..', 'public', 'image0.png');
  const output = tryDecode(target);
  // `output` will contain { rotation, text } on success.

} catch (err) {
  // Decoding failed or the file couldn't be read. Exit with error code 1.
  process.exit(1);
}
