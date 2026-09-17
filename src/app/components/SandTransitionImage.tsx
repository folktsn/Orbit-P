"use client";

import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import { usePresence } from "framer-motion";

export function SandTransitionImage({ src, alt, reducedMotion }: { src: string; alt: string; reducedMotion: boolean }) {
  const [isPresent, safeToRemove] = usePresence();
  const filterId = `chapter-dissolve-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const imageRef = useRef<HTMLDivElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const offsetRef = useRef<SVGFEOffsetElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  useEffect(() => {
    if (reducedMotion) { if (!isPresent) safeToRemove?.(); return; }
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = Math.min((now - start) / 900, 1);
      const dissolve = isPresent ? Math.pow(1 - elapsed, 4) : Math.pow(elapsed, 3);
      displacementRef.current?.setAttribute("scale", String(dissolve * 100));
      offsetRef.current?.setAttribute("dy", String(dissolve * (isPresent ? -55 : 75)));
      blurRef.current?.setAttribute("stdDeviation", String(dissolve * 4));
      if (imageRef.current) imageRef.current.style.opacity = String(Math.max(0, 1 - dissolve * 1.2));
      if (elapsed < 1) frame = requestAnimationFrame(animate);
      else if (!isPresent) safeToRemove?.();
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isPresent, reducedMotion, safeToRemove]);

  return (
    <div ref={imageRef} style={{ position: "absolute", inset: 0, opacity: reducedMotion ? 1 : 0 }}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs><filter id={filterId} x="-20%" y="-25%" width="140%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap ref={displacementRef} in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" />
          <feOffset ref={offsetRef} dy="0" /><feGaussianBlur ref={blurRef} stdDeviation="0" />
        </filter></defs>
      </svg>
      <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 40vw" unoptimized style={{ objectFit: "cover", filter: reducedMotion ? undefined : `url(#${filterId})` }} />
    </div>
  );
}
