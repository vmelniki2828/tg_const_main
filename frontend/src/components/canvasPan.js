export function shouldPan(event, handMode) {
  if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return false;
  const onBlock = !!event.target.closest('.dialog-block');
  return event.button === 1 || event.button === 2 ||
    (event.button === 0 && (handMode || event.altKey || !onBlock));
}
