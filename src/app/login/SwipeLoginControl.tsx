"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronsUp } from "lucide-react";

const SWIPE_DISTANCE = 48;
const MOBILE_QUERY = "(max-width: 760px)";
const IDLE = { lift: 0, dragging: false, ready: false };

type Gesture = { pointerId: number; x: number; y: number };

function isInsideControl(event: PointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
}

export default function SwipeLoginControl({
  disabled,
  onSwipeUp,
}: {
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
    if (disabled || event.button !== 0 || !window.matchMedia(MOBILE_QUERY).matches || !isInsideControl(event)) return;

    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setVisual({ ...IDLE, dragging: true });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const up = active.y - event.clientY;
    const sideways = Math.abs(active.x - event.clientX);

    if (disabled || !window.matchMedia(MOBILE_QUERY).matches || !isInsideControl(event)
      || up < -12 || (sideways > 20 && sideways > Math.abs(up))) {
      resetGesture(event.currentTarget);
      return;
    }

    setVisual({
      lift: Math.min(Math.max(up, 0) / SWIPE_DISTANCE, 1) * 26,
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

    if (!disabled && window.matchMedia(MOBILE_QUERY).matches && isInsideControl(event)
      && up >= SWIPE_DISTANCE && up > sideways * 1.5) {
      // Keep the redirect in this user gesture, just like the existing login button.
      onSwipeUp();
    }
  };

  return (
    <div
      className={`login-swipe-hint${disabled ? "" : " login-swipe-hint--enabled"}`}
      role="group"
      aria-label="เลื่อนขึ้นในช่องเพื่อเข้าสู่ระบบด้วย LINE"
      aria-disabled={disabled}
      style={{ "--login-swipe-lift": `${disabled ? 0 : -visual.lift}px` } as CSSProperties}
      data-swipe-dragging={!disabled && visual.dragging}
      data-swipe-ready={!disabled && visual.ready}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={(event) => resetGesture(event.currentTarget)}
      onLostPointerCapture={(event) => resetGesture(event.currentTarget)}
    >
      <span className="login-swipe-track" aria-hidden="true">
        <span className="login-swipe-icon"><ChevronsUp /></span>
      </span>
      <span>
        <strong className="login-swipe-idle-text">เลื่อนขึ้นในช่องนี้</strong>
        <strong className="login-swipe-ready-text">ปล่อยเพื่อเข้าสู่ระบบ</strong>
        <small>เพื่อเข้าสู่ระบบผ่าน LINE</small>
      </span>
    </div>
  );
}
