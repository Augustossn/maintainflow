// Adapted from Bencho Signature pad (MIT): https://bencho.dev/ — nib smoothing algorithm.
// See THIRD_PARTY_NOTICES.md and licenses/Bencho-MIT.txt. Original implementation: Bencho.
import { useRef, useState, type PointerEvent } from "react";
import { Check, RotateCcw } from "lucide-react";
type Point = { x: number; y: number; t: number; w: number };
export default function SignaturePad({
  onChange,
}: {
  onChange: (value: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<Point[][]>([]);
  const [, render] = useState(0);
  const refresh = () => render((n) => n + 1);
  function point(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * 420) / rect.width,
      y: ((event.clientY - rect.top) * 130) / rect.height,
      t: performance.now(),
      w: 3,
    };
  }
  function start(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    refresh();
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const stroke = strokes.current[strokes.current.length - 1];
    const previous = stroke[stroke.length - 1];
    const next = point(e);
    next.x = previous.x + (next.x - previous.x) * 0.625;
    next.y = previous.y + (next.y - previous.y) * 0.625;
    const distance = Math.hypot(next.x - previous.x, next.y - previous.y);
    if (distance < 0.8) return;
    const speed = distance / Math.max(1, next.t - previous.t);
    const target = 4.7 - (4.7 - 1.8) * Math.min(1, speed / 1.6);
    next.w = previous.w + (target - previous.w) * 0.35;
    stroke.push(next);
    refresh();
  }
  function end() {
    drawing.current = false;
    if (strokes.current.some((s) => s.length > 2))
      onChange(
        "signature:" +
          JSON.stringify(
            strokes.current.slice(0,4).map((s) =>
              s.filter((_,i) => i % Math.max(1,Math.ceil(s.length/100)) === 0).map(({ x, y, w }) => ({
                x: Math.round(x),
                y: Math.round(y),
                w: +w.toFixed(1),
              })),
            ),
          ),
      );
  }
  const signed = strokes.current.some((s) => s.length > 2);
  return (
    <div className="signature-pad">
      <svg
        ref={svg}
        viewBox="0 0 420 130"
        role="img"
        aria-label="Área de assinatura do técnico. Alternativa acessível: confirmação digitada acima."
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <line
          x1="20"
          y1="103"
          x2="400"
          y2="103"
          stroke="#d8e1cc"
          strokeDasharray="4 4"
        />
        {strokes.current.flatMap((stroke, i) =>
          stroke.slice(1).map((p, j) => {
            const previous = stroke[j];
            return (
              <path
                key={`${i}-${j}`}
                d={`M ${previous.x} ${previous.y} Q ${previous.x} ${previous.y} ${(previous.x + p.x) / 2} ${(previous.y + p.y) / 2}`}
                fill="none"
                stroke="#325b36"
                strokeWidth={p.w}
                strokeLinecap="round"
              />
            );
          }),
        )}
      </svg>
      <div>
        <span>
          {signed ? (
            <>
              <Check size={13} />
              Assinatura registrada
            </>
          ) : (
            "Assine aqui ou use a confirmação digitada"
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            strokes.current = [];
            onChange("");
            refresh();
          }}
          aria-label="Limpar assinatura"
        >
          <RotateCcw size={13} />
          Limpar
        </button>
      </div>
    </div>
  );
}
