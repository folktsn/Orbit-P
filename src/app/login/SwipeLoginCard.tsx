"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const SWIPE_DISTANCE = 80;
const MOBILE_QUERY = "(max-width: 760px)";
const INTERACTIVE_TARGET = "button, a, input, select, textarea, [role='button'], [contenteditable='true']";
const IDLE = { lift: 0, dragging: false, ready: false };

type Gesture = { pointerId: number; x: number; y: number };

export default function SwipeLoginCard({
  children,
  disabled,
  onSwipeUp,
}: {
  children: ReactNode;
  disabled: boolean;
  onSwipeUp: () => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const [visual, setVisual] = useState(IDLE);

  const resetGesture = (element: HTMLElement) => {
    const active = gesture.current;
    gesture.current = null;
    setVisual(IDLE);
    if (active && element.hasPointerCapture(active.pointerId)) {
      element.releasePointerCapture(active.pointerId);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    // A second finger cancels the gesture so pinch zoom never starts login.
    if (!event.isPrimary) {
      resetGesture(event.currentTarget);
      return;
    }
    if (disabled || event.button !== 0 || !window.matchMedia(MOBILE_QUERY).matches) return;
    if (event.target instanceof Element && event.target.closest(INTERACTIVE_TARGET)) return;

    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setVisual({ ...IDLE, dragging: true });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const up = active.y - event.clientY;
    const sideways = Math.abs(active.x - event.clientX);

    if (disabled || !window.matchMedia(MOBILE_QUERY).matches || up < -12 || (sideways > 20 && sideways > Math.abs(up))) {
      resetGesture(event.currentTarget);
      return;
    }

    setVisual({
      lift: Math.min(Math.max(up, 0) * 0.4, 40),
      dragging: true,
      ready: up >= SWIPE_DISTANCE && up > sideways * 1.5,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const up = active.y - event.clientY;
    const sideways = Math.abs(active.x - event.clientX);
    resetGesture(event.currentTarget);

    if (!disabled && window.matchMedia(MOBILE_QUERY).matches && up >= SWIPE_DISTANCE && up > sideways * 1.5) {
      // Keep the redirect in this user gesture, just like the existing login button.
      onSwipeUp();
    }
  };

  return (
    <section
      className={`login-content${disabled ? "" : " login-content--swipe"}`}
      style={{ "--login-swipe-lift": `${disabled ? 0 : -visual.lift}px` } as CSSProperties}
      data-swipe-dragging={!disabled && visual.dragging}
      data-swipe-ready={!disabled && visual.ready}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={(event) => resetGesture(event.currentTarget)}
      onLostPointerCapture={(event) => resetGesture(event.currentTarget)}
    >
      {children}
    </section>
  );
}
