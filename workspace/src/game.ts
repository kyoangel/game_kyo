const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

function update(_deltaTime: number): void {
  // TODO: update game state
}

function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // TODO: draw game state
}

let lastTime = 0;
function loop(timestamp: number): void {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  update(deltaTime);
  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
