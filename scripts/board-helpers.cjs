async function boardPoint(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('#game canvas'), box = canvas.getBoundingClientRect();
    const scale = Number(canvas.dataset.scale);
    return {
      x: box.x + box.width / 2 + (x - Number(canvas.dataset.centerX)) * scale,
      y: box.y + box.height / 2 - (y - Number(canvas.dataset.centerY)) * scale,
    };
  }, { x, y });
}
module.exports = { boardPoint };
