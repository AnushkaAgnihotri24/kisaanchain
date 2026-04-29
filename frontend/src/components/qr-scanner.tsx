"use client";

import { useEffect, useId, useRef, useState } from "react";

export function QrScanner({
  onScan
}: {
  onScan: (decodedText: string) => void;
}) {
  const elementId = useId().replace(/:/g, "");
  const [supported, setSupported] = useState(true);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let mounted = true;

    async function boot() {
      try {
        const qrModule = await import("html5-qrcode");
        const Html5Qrcode = qrModule.Html5Qrcode;
        scanner = new Html5Qrcode(elementId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            onScanRef.current(decodedText);
          },
          () => {}
        );
      } catch {
        if (mounted) {
          setSupported(false);
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
      if (scanner) {
        void scanner.stop().then(() => scanner?.clear()).catch(() => {});
      }
    };
  }, [elementId]);

  if (!supported) {
    return <p className="helper-text">Camera scanning is unavailable in this browser. Use the manual batch ID or token field instead.</p>;
  }

  return <div id={elementId} className="scanner-box" />;
}
