"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  CALCULATOR_EXPORT_HEIGHT,
  CALCULATOR_EXPORT_WIDTH,
  drawCalculatorQuote,
  loadCalculatorQuoteAssets,
  type CalculatorQuoteModel
} from "@/lib/calculator-quote-canvas";

export type CalculatorQuotePreviewHandle = { exportPng: () => Promise<void> };

export const CalculatorQuotePreview = forwardRef<CalculatorQuotePreviewHandle, { model: CalculatorQuoteModel }>(
  function CalculatorQuotePreview({ model }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);

    const render = useCallback(async (scale = 1) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("ไม่พบพื้นที่ Preview");
      const assets = await loadCalculatorQuoteAssets(model.profile);
      drawCalculatorQuote(canvas, model, assets, scale);
      setReady(true);
      return canvas;
    }, [model]);

    useEffect(() => {
      setReady(false);
      render().catch(() => setReady(false));
    }, [render]);

    useImperativeHandle(ref, () => ({
      async exportPng() {
        const canvas = await render(2);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("ไม่สามารถสร้างไฟล์รูปได้");
        const fileName = `bigcar-installment-${Date.now()}.png`;
        const file = new File([blob], fileName, { type: "image/png" });
        const shareData = { title: "ข้อเสนอค่างวด BIG CAR", text: "ตารางค่างวดรถมือสอง", files: [file] };
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        await render(1);
      }
    }), [render]);

    return (
      <div className="calculator-quote-frame" data-testid="calculator-quote-preview">
        {!ready && <div className="calculator-quote-loading">กำลังสร้าง Preview…</div>}
        <canvas
          ref={canvasRef}
          width={CALCULATOR_EXPORT_WIDTH}
          height={CALCULATOR_EXPORT_HEIGHT}
          className="calculator-quote-canvas"
          aria-label="ตัวอย่างรูปค่างวด BIG CAR"
        />
      </div>
    );
  }
);
