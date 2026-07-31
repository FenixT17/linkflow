"use client";

import { useEffect } from "react";

function preventZoomKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    const key = event.key;
    const code = event.code;
    if (
      key === "+" ||
      key === "-" ||
      key === "0" ||
      key === "=" ||
      code === "NumpadAdd" ||
      code === "NumpadSubtract" ||
      code === "Numpad0" ||
      code === "Digit0"
    ) {
      event.preventDefault();
    }
  }
}

function preventWheelZoom(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
  }
}

function preventGesture(event: Event) {
  event.preventDefault();
}

export function ZoomBlocker() {
  useEffect(() => {
    // Keyboard zoom shortcuts
    window.addEventListener("keydown", preventZoomKey, { passive: false });
    // Ctrl + wheel zoom
    window.addEventListener("wheel", preventWheelZoom, { passive: false });
    // iOS pinch gestures
    window.addEventListener("gesturestart", preventGesture, { passive: false });
    window.addEventListener("gesturechange", preventGesture, { passive: false });
    window.addEventListener("gestureend", preventGesture, { passive: false });

    return () => {
      window.removeEventListener("keydown", preventZoomKey);
      window.removeEventListener("wheel", preventWheelZoom);
      window.removeEventListener("gesturestart", preventGesture);
      window.removeEventListener("gesturechange", preventGesture);
      window.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return null;
}
