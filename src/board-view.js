export const boardView = { zoom: 1, x: 0, y: 0, scale: 1 };
export function setBoardZoom(value) {
  if (Number.isFinite(value)) boardView.zoom = Math.max(1, Math.min(1.8, value));
}
export function panBoard(dx, dy) {
  boardView.x -= dx / boardView.scale;
  boardView.y += dy / boardView.scale;
}
export function resetBoardPan() { boardView.x = boardView.y = 0; }
