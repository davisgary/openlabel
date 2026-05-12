"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LuScanBarcode, LuCheck, LuScanSearch, LuCircleHelp } from 'react-icons/lu';
import ProductDetails from './scan/ProductDetails';
import AskAI from './scan/AskAI';
import { getZxReader, zxingDecode, serverDecode, captureFrame, BARCODE_FORMATS } from './scan/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Scan() {
  
  const [barcode, setBarcode]                   = useState('');
  const [inputFocused, setInputFocused]         = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning]                 = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [product, setProduct]                   = useState<any>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [detectedCode, setDetectedCode]         = useState<string | null>(null);
  const [capturedImage, setCapturedImage]       = useState<string | null>(null);
  const [hasTorch, setHasTorch]                 = useState(false);
  const [torchOn, setTorchOn]                   = useState(false);
  const [takePhotoLoading, setTakePhotoLoading] = useState(false);
  const [queryForAI, setQueryForAI]             = useState<string | null>(null);
  const [showSlowMessage, setShowSlowMessage]   = useState(false);
  const videoRef     = useRef<HTMLVideoElement | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  // Call stopScanRef.current() to halt whichever detection loop is active
  const stopScanRef  = useRef<(() => void) | null>(null);
  // Guards against concurrent lookups from two detection paths
  const lookingUpRef = useRef(false);

  // ── Product lookup ────────────────────────────────────────────────────────
  async function lookup(code: string): Promise<boolean> {
    setError(null);
    setProduct(null);
    setLoading(true);
    // reset any delayed message state — a new lookup just started
    setShowSlowMessage(false);
    try {
      const res = await fetch(`/api/product?barcode=${encodeURIComponent(code)}`);
      if (!res.ok) return false;
      setProduct(await res.json());
      return true;
    } catch (e: any) {
      setError(e.message || 'Lookup failed');
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Show a friendly message if product lookup is still in progress after a short delay
  useEffect(() => {
    let t: number | undefined;
    if (loading && !product) {
      // show message after 3.5 seconds
      t = window.setTimeout(() => setShowSlowMessage(true), 3500);
    } else {
      setShowSlowMessage(false);
    }
    return () => { if (t) window.clearTimeout(t); };
  }, [loading, product]);



  // ── Single entry point called by every detection path ────────────────────
  function onBarcodeDetected(raw: string) {
    if (lookingUpRef.current) return;
    const code = raw.trim();
    if (!code) return;
    lookingUpRef.current = true;
    setDetectedCode(code);
    setBarcode(code);
    lookup(code)
      .then((ok) => {
        if (ok) {
          stopCamera();
        } else {
          lookingUpRef.current = false;
          setDetectedCode(null);
        }
      })
      .catch(() => { lookingUpRef.current = false; });
  }

  // ── Start camera + detection ──────────────────────────────────────────────
  async function startCamera() {
    setError(null);
    setProduct(null);
    setCapturedImage(null);
    setDetectedCode(null);
    lookingUpRef.current = false;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Camera not available. Please enter the barcode manually.');
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Warm up the shared ZXing reader in parallel with getUserMedia —
    // by the time the stream is ready, the module is already loaded.
    getZxReader();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isMobile ? 'environment' : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setScanning(true);

      // Wait for the video element to be mounted after setting `scanning`.
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const check = () => {
          if (videoRef.current) return resolve();
          if (Date.now() - start > 2000) return resolve(); // give up after 2s
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });

      const video = videoRef.current;
      if (!video) {
        // video element didn't mount in time — stop stream and error out
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setScanning(false);
        setError('Camera element not available. Please try again.');
        return;
      }

      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        if (video.readyState >= 1) resolve();
      });
      await video.play().catch(() => {});

      // Torch detection
      try {
        const track = stream.getVideoTracks()[0];
        const caps = (track as any).getCapabilities?.() ?? null;
        setHasTorch(!!(caps as any)?.torch);
      } catch { /* not supported */ }

      // ── PATH 1: native BarcodeDetector (Chrome desktop + Android Chrome) ─
      if (typeof (window as any).BarcodeDetector === 'function') {
        const Detector = (window as any).BarcodeDetector;
        const supported: string[] = (await Detector.getSupportedFormats?.()) ?? BARCODE_FORMATS;
        const detector = new Detector({ formats: supported.length ? supported : BARCODE_FORMATS });
        let active = true;

        const loop = async () => {
          if (!active || !streamRef.current) return;
          if (!lookingUpRef.current && video.readyState >= 2) {
            try {
              const [hit] = await detector.detect(video);
              if (hit) { active = false; onBarcodeDetected(String(hit.rawValue ?? hit.rawData)); return; }
            } catch { /* no barcode — normal */ }
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        stopScanRef.current = () => { active = false; };
        return; // don't start ZXing
      }

      // ── PATH 2: ZXing client rAF + server while loop (iOS Safari/Firefox) ─
      // getZxReader() was warmed up in parallel — just await the cached singleton
      const zx = await getZxReader();

      // Decode canvas: draw video downscaled to 640px-wide for faster ZXing + smaller server payload
      const DECODE_W = 640;
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d', { willReadFrequently: true })!;

      // Set canvas size once when video dimensions are known, then never change
      function initCanvas() {
        const v = videoRef.current;
        if (v && v.videoWidth > 0 && canvas.width === 0) {
          const scale = DECODE_W / v.videoWidth;
          canvas.width  = DECODE_W;
          canvas.height = Math.round(v.videoHeight * scale);
        }
      }

      let active        = true;
      let lastClientMs  = 0;
      const CLIENT_INTERVAL = 100; // ms — ~10 fps, fast enough for snappy feel

      // Server loop: next request fires immediately after the previous one returns,
      // so latency ≈ one round-trip (~200–400 ms). No artificial sleep.
      const serverLoop = async () => {
        while (active && !lookingUpRef.current) {
          if (!streamRef.current) break;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            initCanvas();
            try {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const text = await serverDecode(canvas);
              if (text && active && !lookingUpRef.current) { active = false; onBarcodeDetected(text); return; }
            } catch { /* ignore */ }
          } else {
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      };
      serverLoop();

      // rAF loop: faster client-side ZXing in parallel
      const loop = () => {
        if (!active || !streamRef.current || lookingUpRef.current) return;
        const now = performance.now();
        if (video.readyState >= 2 && video.videoWidth > 0 && now - lastClientMs >= CLIENT_INTERVAL) {
          lastClientMs = now;
          initCanvas();
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const text = zx.decode(canvas);
            if (text) { active = false; onBarcodeDetected(text); return; }
          } catch { /* NotFoundException every non-barcode frame — normal */ }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      stopScanRef.current = () => { active = false; };

    } catch (e: any) {
      setError(e.message || 'Could not access camera');
      setScanning(false);
    }
  }

  // ── Stop camera ───────────────────────────────────────────────────────────
  function stopCamera() {
    stopScanRef.current?.();
    stopScanRef.current  = null;
    lookingUpRef.current = false;
    setScanning(false);
    setDetectedCode(null);
    setHasTorch(false);
    setTorchOn(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; }
    } catch { /* ignore */ }
  }

  // Cleanup on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stopCamera(), []);

  // footer is rendered inline (no portal/measurement) to avoid positioning drift on resize/navigation

  // Pause/resume video when a captured snapshot overlay is shown
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (capturedImage) { v.pause(); }
      else if (scanning && streamRef.current) { void v.play(); }
    } catch { /* ignore */ }
  }, [capturedImage, scanning]);

  // ── Manual "Take Photo" ───────────────────────────────────────────────────
  async function takePhoto() {
    if (!videoRef.current || takePhotoLoading) return;
    lookingUpRef.current = false;
    setCapturedImage(null);
    setError(null);
    setTakePhotoLoading(true);

    const canvas = captureFrame(videoRef.current);
    if (!canvas) {
      setError('Camera not ready — please try again.');
      setTakePhotoLoading(false);
      return;
    }
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));

    const clientResult = await zxingDecode(canvas);
    if (clientResult) { setTakePhotoLoading(false); onBarcodeDetected(clientResult); return; }

    const serverResult = await serverDecode(canvas);
    if (serverResult) { setTakePhotoLoading(false); onBarcodeDetected(serverResult); return; }

    setCapturedImage(null);
    setTakePhotoLoading(false);
    setError('Could not read the barcode. Make sure it is well-lit and centred, then try again.');
  }

  // ── Torch ─────────────────────────────────────────────────────────────────
  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const desired = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: desired }] });
      setTorchOn(desired);
    } catch {
      try {
        await (track as any).applyConstraints({ torch: desired });
        setTorchOn(desired);
      } catch { /* torch not supported */ }
    }
  }

  


  return (
    <>
      {/* Header */}
      <div className="w-full max-w-3xl mx-auto mt-6 md:mt-14 md:px-8">
        <div className="relative">
          <div className="w-full flex flex-row items-start justify-center">
            <div className="text-center min-w-0">
              <h1 className="text-3xl text-primary-foreground font-medium tracking-tight">What product do you want to check?</h1>
              <p className="mt-2 text-sm text-primary-foreground/80">Then Ask AI to get a deeper breakdown of the product and its ingredients.</p>
            </div>
          </div>
        </div>
      </div>

  <div className="w-full max-w-3xl mx-auto my-4 flex flex-col items-center justify-center md:px-8">
        {/* Main: video / product area — let the page scroll, not this card */}
        <div className="w-full">
    <div className="space-y-4 flex flex-col items-center justify-center">
          {scanning && (
            <div className="relative overflow-hidden min-h-[220px] max-h-[530px] w-full">
              {/* helper label above video */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 px-3 py-1 text-sm rounded-lg pointer-events-none bg-black/60 text-white whitespace-nowrap">
                Hold barcode flat inside the frame
              </div>

              <video ref={videoRef} className="w-full h-75 sm:h-65 md:h-55 object-cover" playsInline />
                <>
                <div className="absolute left-0 right-0 bottom-8 flex items-center justify-center gap-3 pointer-events-auto z-30">
                  <div className="rounded-xl p-2 flex items-center gap-2 bg-black/50">
                    <button
                      onClick={takePhoto}
                      disabled={takePhotoLoading || loading}
                      className="px-4 py-2 rounded-full font-medium border border-primary-foreground text-primary-foreground disabled:opacity-60 flex items-center gap-2"
                      aria-label="Take photo"
                    >
                      {(takePhotoLoading || loading) ? (
                        <span className="inline-block self-center align-middle w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : null}
                      {(takePhotoLoading || loading) ? 'Scanning…' : 'Take Photo'}
                    </button>
                    {hasTorch && (
                      <button
                        onClick={() => toggleTorch()}
                        className={`px-4 py-2 rounded-full font-medium border border-primary-foreground ${torchOn ? 'bg-yellow-400 text-black' : 'text-primary-foreground'}`}
                        aria-pressed={torchOn}
                        aria-label="Toggle light"
                      >
                        {torchOn ? 'Light Off' : 'Light On'}
                      </button>
                    )}
                  </div>
                </div>
                </>

              {/* scanning overlay - transparent center so barcode remains visible */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className={`w-[96%] h-[93%] border-2 rounded-xl relative overflow-hidden transition-colors duration-300 ${detectedCode ? 'border-accent/90' : (scanning ? 'border-primary/70 animate-pulse' : 'border-primary/30')}`}>
                  {capturedImage ? (
                    <img src={capturedImage} alt="capture preview" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    detectedCode && (
                      <div className="absolute top-2 right-2 bg-accent px-2 py-1 text-xs rounded text-accent-foreground pointer-events-none">Detected: {detectedCode}</div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {error && <div className="text-destructive">{error}</div>}

            <div className={`${product ? '' : 'hidden'} bg-card p-6 sm:px-8 rounded-lg border border-muted dark:border-muted/30 shadow-sm space-y-6`}>
              {product ? (
                <>
                  <ProductDetails product={product} onAskAI={(q) => setQueryForAI(q)} />
                  <AskAI 
                    product={product} 
                    detectedCode={detectedCode} 
                    barcode={barcode} 
                    externalQuery={queryForAI} 
                    onQueryProcessed={() => setQueryForAI(null)}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full my-5">
        <div className="flex justify-center">
          <div className="w-full pointer-events-auto max-w-md mx-auto">
            <div className="w-full flex flex-col items-center gap-3">
                <button
                  onClick={() => (scanning ? stopCamera() : startCamera())}
                  className={`w-full px-10 py-3.5 rounded-full font-medium flex items-center justify-center gap-3 hover:opacity-80 transition-opacity duration-300 ease-out delay-75 ${scanning ? 'bg-destructive text-primary-foreground' : 'bg-primary-foreground text-primary'}`}
                >
                  <LuScanBarcode className={`w-[1.375rem] h-[1.375rem] ${scanning ? 'animate-pulse' : ''}`} />
                  <span>{scanning ? 'Stop Scanning' : 'Scan Barcode'}</span>
                </button>

                <div className="relative w-full overflow-visible">
                  <input
                    id="barcode"
                    name="barcode"
                    className="w-full font-medium appearance-none bg-input/10 text-primary-foreground placeholder-transparent border border-primary-foreground/40 rounded-full px-4 py-3.5 pl-16 pr-4 text-left focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-transparent focus:shadow-none focus:border-accent dark:focus:border-accent transition-colors duration-200"
                    style={{ caretColor: 'var(--primary-foreground)' }}
                    placeholder="Enter barcode (e.g. 014113910934)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    ref={inputRef}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!loading) lookup(barcode);
                      }
                    }}
                  />

                  {/* Visual overlay: left-aligned icon + placeholder when empty; icon only when typing. */}
                  <div className="pointer-events-none absolute inset-0 flex items-center">
                      <div
                        onClick={() => inputRef.current?.focus()}
                        role="textbox"
                        aria-label="Focus barcode input"
                        tabIndex={0}
                        className={`absolute left-0 right-0 inset-y-0 flex items-center justify-center text-primary-foreground/80 transition-all duration-200 ease-out transform whitespace-nowrap cursor-text ${(!barcode && !inputFocused) ? 'opacity-100 pointer-events-auto z-20' : 'opacity-0 -translate-x-3 pointer-events-none z-0'} px-3`}
                        onMouseEnter={() => { /* purely visual */ }}
                      >
                        <span className="inline-flex items-center gap-3 leading-none">
                          {loading ? (
                            <span className="inline-block self-center align-middle w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <LuScanSearch className="w-[1.375rem] h-[1.375rem]" />
                          )}
                          <span className="font-medium">Enter barcode (e.g. 014113910934)</span>
                        </span>
                      </div>

                    {/* left icon (clickable when active) */}
                    <div className="relative w-full">
                      <button
                        type="button"
                        onClick={() => { if (!loading) void lookup(barcode); }}
                        disabled={loading}
                        aria-label="Search barcode"
                        className={`absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-11 w-11 p-2 rounded-full transition-all duration-200 ease-out transform ${barcode || inputFocused ? 'opacity-100 translate-x-0 pointer-events-auto z-10' : 'opacity-0 translate-x-2 pointer-events-none z-0'}`}
                      >
                        {loading ? (
                          <span className="inline-block self-center align-middle w-[1.375rem] h-[1.375rem] border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <LuScanSearch className="w-[1.375rem] h-[1.375rem]" />
                        )}
                      </button>
                    </div>
                  </div>

                </div>

                {loading && !product && showSlowMessage && (
                  <div className="w-full flex justify-start ms-10 ps-2">
                    <div className="text-sm text-muted-foreground animate-pulse">Still getting product data...</div>
                  </div>
                )}

            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
