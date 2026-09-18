"use client";

import { animate, useInView, useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Count-up presentation inspired by https://reactbits.dev/text-animations/count-up.
export function CountUp({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const completedEntrance = useRef(false);
  const displayedValue = useMotionValue(0);
  const isInView = useInView(elementRef, { once: true, amount: 0.3 });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const paint = (latest: number) => { element.textContent = numberFormat.format(Math.round(latest)); };
    paint(displayedValue.get());
    return displayedValue.on("change", paint);
  }, [displayedValue]);

  useEffect(() => {
    if (reducedMotion) {
      displayedValue.jump(value);
      completedEntrance.current = true;
      return;
    }
    if (!isInView) return;
    if (displayedValue.get() === value) {
      completedEntrance.current = true;
      return;
    }

    // Live changes continue from the currently displayed value, in either direction.
    const animation = animate(displayedValue, value, {
      duration: completedEntrance.current ? 0.65 : 2,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        displayedValue.set(value);
        completedEntrance.current = true;
      },
    });
    return () => animation.stop();
  }, [displayedValue, isInView, reducedMotion, value]);

  return <span ref={elementRef} data-count-up={value} aria-hidden="true">0</span>;
}
