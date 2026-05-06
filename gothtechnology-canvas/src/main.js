import { GothTechnologyGame } from "./scenes/game.js";

const canvas = document.getElementById("game");
if (window.__gothTechnologyGame?.stop) window.__gothTechnologyGame.stop();
const game = new GothTechnologyGame(canvas);
window.__gothTechnologyGame = game;
game.render();
game.boot().catch((error) => {
  console.error("[GOTHTECHNOLOGY] Boot failed", error);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd66d";
  ctx.font = "700 32px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("GOTHTECHNOLOGY asset boot failed", canvas.width / 2, canvas.height / 2);
});
