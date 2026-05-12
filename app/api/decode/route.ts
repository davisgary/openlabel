import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import Quagga from '@ericblade/quagga2';
import {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  DecodeHintType,
  RGBLuminanceSource,
  BarcodeFormat,
} from '@zxing/library';

const PREFERRED_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.RSS_14,
  BarcodeFormat.QR_CODE,
];

// Module-level singleton reader — created once at cold start, reused for every request
const _serverReader = (() => {
  const r = new MultiFormatReader();
  const hints = new Map<DecodeHintType, any>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, PREFERRED_FORMATS);
  r.setHints(hints);
  return r;
})();

function toGreyscale(data: Uint8ClampedArray, width: number, height: number) {
  const grey = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grey[i] = grey[i + 1] = grey[i + 2] = luminance;
    grey[i + 3] = 255;
  }
  return grey;
}

function invertImage(data: Uint8ClampedArray) {
  const inverted = new Uint8ClampedArray(data);
  for (let i = 0; i < inverted.length; i += 4) {
    inverted[i] = 255 - inverted[i];
    inverted[i + 1] = 255 - inverted[i + 1];
    inverted[i + 2] = 255 - inverted[i + 2];
  }
  return inverted;
}

function decodeWithQuagga(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    Quagga.decodeSingle(
      {
        src,
        numOfWorkers: 0,
        inputStream: { size: 640 },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'],
          multiple: false,
        },
        locate: false,
      },
      (result) => {
        resolve(result?.codeResult?.code ?? null);
      },
    );
  });
}

function rotateImageData(data: Uint8ClampedArray, width: number, height: number, rotation: number) {
  if (rotation === 0) {
    return { data, width, height };
  }
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body || {};
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Missing image payload' }, { status: 400 });
    }

    const match = image.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/i);
    if (!match) {
      return NextResponse.json({ error: 'Invalid image encoding' }, { status: 400 });
    }

    const format = match[1].toLowerCase();
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');

    let width: number;
    let height: number;
    let dataOrBuffer: Uint8Array | Buffer;

    if (format === 'png') {
      const png = PNG.sync.read(buffer);
      width = png.width;
      height = png.height;
      dataOrBuffer = png.data;
    } else {
      const raw = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
      width = raw.width;
      height = raw.height;
      dataOrBuffer = raw.data;
    }

    const clamped = new Uint8ClampedArray(dataOrBuffer);

    const zxingAttempts = async (): Promise<string | null> => {
      try {
        const source = new RGBLuminanceSource(clamped, width, height);
        const result = _serverReader.decode(new BinaryBitmap(new HybridBinarizer(source)));
  const text = result.getText();
  if (text) { return text; }
      } catch {}

      try {
        const rotated = rotateImageData(clamped, width, height, 180);
        const source = new RGBLuminanceSource(rotated.data, rotated.width, rotated.height);
        const result = _serverReader.decode(new BinaryBitmap(new HybridBinarizer(source)));
  const text = result.getText();
  if (text) { return text; }
      } catch {}

      try {
        const inv = invertImage(clamped);
        const source = new RGBLuminanceSource(inv, width, height);
        const result = _serverReader.decode(new BinaryBitmap(new HybridBinarizer(source)));
  const text = result.getText();
  if (text) { return text; }
      } catch {}

      return null;
    };

    const quaggaAttempt = decodeWithQuagga(image).catch(() => null);

    const text = await Promise.race([
      zxingAttempts(),
      quaggaAttempt,
    ]);

    const fallback = text == null ? await quaggaAttempt : null;
    const result = text ?? fallback;

    if (result) {
      return NextResponse.json({ text: result }, { status: 200 });
    }

    throw new Error('Unable to decode barcode on server.');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unable to decode barcode' }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Decode route is up' });
}
