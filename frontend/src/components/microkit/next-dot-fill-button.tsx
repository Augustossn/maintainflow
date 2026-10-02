import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";

export function NextDotFillButton({
  label = "Concluir",
  ...props
}: ComponentProps<"button"> & { label?: string }) {
  return (
    <button
      {...props}
      type="button"
      className="group relative inline-flex h-[40px] w-[min(180px,calc(100vw_-_40px))] cursor-pointer appearance-none items-center justify-center overflow-hidden rounded-full border border-[#d2ddcc] bg-white p-0 text-xs font-medium leading-none text-[#32623e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#267563]"
    >
      <span
        className="absolute left-[26px] top-[calc(50%_-_4.5px)] z-[1] size-[9px] rounded-full bg-[light-dark(#14181e,#0a0a0a)] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[28] group-focus-visible:scale-[28] motion-reduce:transition-none"
        aria-hidden="true"
      />
      <span className="relative z-0 translate-x-[5px] [transition:transform_.35s_cubic-bezier(.16,1,.3,1),opacity_.3s_ease] group-hover:translate-x-[46px] group-hover:opacity-0 group-focus-visible:translate-x-[46px] group-focus-visible:opacity-0 motion-reduce:transition-none">
        {label}
      </span>
      <span
        className="absolute inset-0 z-[2] inline-flex translate-x-[46px] items-center justify-center gap-2 text-[light-dark(#ffffff,#fafafa)] opacity-0 [transition:transform_.35s_cubic-bezier(.16,1,.3,1),opacity_.3s_ease] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      >
        {label}
        <ArrowRight className="shrink-0" size={19} strokeWidth={2.4} />
      </span>
    </button>
  );
}
