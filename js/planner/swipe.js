// Swipe on a card with Pointer Events. The decision is pure; the wiring is thin.

export function swipeDecision(dx, width, threshold) {
  if (dx > threshold * width) return 'right';
  if (dx < -threshold * width) return 'left';
  return null;
}

export function attachSwipe(node, { onLeft, onRight, threshold = 0.3 }) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let startX = null;
  const move = (dx) => {
    if (still) return;
    node.style.transition = 'none';
    node.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
  };
  const reset = () => {
    startX = null;
    node.style.transition = still ? '' : 'transform .2s';
    node.style.transform = '';
  };
  node.style.touchAction = 'pan-y';
  node.onpointerdown = (e) => {
    startX = e.clientX;
    node.setPointerCapture(e.pointerId);
  };
  node.onpointermove = (e) => { if (startX !== null) move(e.clientX - startX); };
  node.onpointercancel = reset;
  node.onpointerup = (e) => {
    const decision = swipeDecision(e.clientX - startX, node.getBoundingClientRect().width, threshold);
    reset();
    if (decision === 'right') onRight();
    if (decision === 'left') onLeft();
  };
}
