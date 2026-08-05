import Phaser from "phaser";
import { boardNodes } from "../content/board";
import { districts } from "../content/districts";
import { ventures } from "../content/ventures";
import type { GameState, NodeKind } from "../engine/state";

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 850;

const landmarks = [
  ["Gordie Howe International Bridge", 190, 782],
  ["Ambassador Bridge", 405, 735],
  ["Michigan Central", 590, 650],
  ["Guardian Building · Campus Martius", 790, 590],
  ["Renaissance Center", 945, 627],
  ["Comerica Park", 495, 220],
  ["Little Caesars Arena", 615, 248],
  ["Ford Field", 700, 205],
  ["Fox Theatre", 735, 345],
  ["Fisher Building · New Center", 650, 168],
  ["Eastern Market", 1060, 430],
  ["Belle Isle Conservatory", 1240, 610],
] as const;

const streets = [
  ["Woodward Ave", 760, 405, -68],
  ["Michigan Ave", 590, 610, -12],
  ["Jefferson Ave", 930, 665, -4],
  ["Gratiot Ave", 1040, 435, -26],
  ["Grand River Ave", 505, 410, 20],
  ["Vernor Hwy", 470, 665, -3],
  ["Livernois Ave", 350, 430, -82],
  ["Cass Ave", 695, 430, -70],
] as const;

const gatewayForKind: Record<Exclude<NodeKind, "venture">, number> = {
  hub: 0,
  transit: 1,
  pulse: 2,
  signal: 3,
  oracle: 4,
  lab: 5,
  studio: 6,
  grant: 7,
};

export class BoardScene extends Phaser.Scene {
  private state?: GameState;
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private ventureSprites = new Map<number, Phaser.GameObjects.Image>();
  private board!: Phaser.GameObjects.Container;
  private dragging = false;
  private lastPointer?: Phaser.Math.Vector2;

  constructor() {
    super("board");
  }

  preload() {
    this.load.image("detroit-board", "./assets/art/detroit-fortune-grid-board.png");
    this.load.image("guardian-vault", "./assets/art/guardian-vault.png");
    this.load.image("mascot-token", "./assets/art/mascot/01.png");
    for (let index = 1; index <= 6; index += 1) {
      this.load.image(`player-token-${index}`, `./assets/art/tokens/token-${String(index).padStart(2, "0")}.png`);
    }
    for (let index = 1; index <= 8; index += 1) {
      this.load.image(`gateway-${index}`, `./assets/art/gateways/gateway-${String(index).padStart(2, "0")}.png`);
    }
    for (let index = 1; index <= 4; index += 1) {
      this.load.image(`venture-level-${index}`, `./assets/art/ventures/venture-level-${index}.png`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor("#05040a");
    this.board = this.add.container(0, 0);
    this.drawEnvironment();
    this.drawBoard();
    this.setupCamera();
    this.scale.on("resize", () => this.fitOverview());
    this.fitOverview();
  }

  private pos(id: number) {
    const node = boardNodes[id];
    return { x: node.x * 14, y: node.y * 12 };
  }

  private drawEnvironment() {
    const background = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "detroit-board");
    background.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setAlpha(0.9).setDepth(-30);
    this.board.add(background);

    const streetLayer = this.add.graphics();
    streetLayer.lineStyle(2, 0x61e7ff, 0.2);
    streetLayer.lineBetween(780, 650, 630, 110);
    streetLayer.lineBetween(795, 615, 250, 690);
    streetLayer.lineBetween(490, 680, 1210, 625);
    streetLayer.lineBetween(820, 575, 1320, 255);
    streetLayer.lineBetween(790, 570, 235, 235);
    streetLayer.setDepth(-10);
    this.board.add(streetLayer);

    streets.forEach(([name, x, y, angle]) => {
      const label = this.add.text(x, y, name, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#8beeff",
        backgroundColor: "rgba(2, 4, 10, .72)",
        padding: { x: 5, y: 3 },
      });
      label.setOrigin(0.5).setAngle(angle).setDepth(-8);
      this.board.add(label);
    });

    landmarks.forEach(([name, x, y]) => {
      const label = this.add.text(x, y, name, {
        fontFamily: "Arial",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#fff1b5",
        backgroundColor: "rgba(5, 3, 10, .82)",
        padding: { x: 6, y: 4 },
      });
      label.setOrigin(0.5).setDepth(3);
      this.board.add(label);
    });
  }

  private drawBoard() {
    const route = this.add.graphics();
    route.lineStyle(7, 0xf1c75b, 0.46);
    const seen = new Set<string>();
    boardNodes.forEach((node) =>
      node.edges.forEach((edge) => {
        const key = [node.id, edge].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);
        const a = this.pos(node.id);
        const b = this.pos(edge);
        route.lineBetween(a.x, a.y, b.x, b.y);
      }),
    );
    this.board.add(route);

    boardNodes.forEach((node) => {
      const position = this.pos(node.id);
      const group = this.add.container(position.x, position.y);
      const disc = this.add
        .circle(0, 0, node.kind === "venture" ? 17 : 23, node.kind === "venture" ? 0x21143b : 0xb78432, 0.95)
        .setStrokeStyle(3, node.kind === "venture" ? 0xe4b950 : 0xffe49a);
      const label = node.kind === "venture" ? ventures[node.ventureId!].name : node.label;
      const text = this.add
        .text(0, 29, label, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#ffffff",
          align: "center",
          backgroundColor: "rgba(5, 3, 10, .78)",
          padding: { x: 4, y: 2 },
          wordWrap: { width: 116 },
        })
        .setOrigin(0.5, 0);

      group.add([disc]);
      if (node.kind === "venture") {
        const marker = this.add
          .text(0, 0, districts[Math.floor(node.ventureId! / 3)].symbol, {
            fontFamily: "Arial",
            fontSize: "15px",
            color: "#ffffff",
          })
          .setOrigin(0.5);
        const building = this.add.image(0, -20, "venture-level-1").setDisplaySize(58, 58).setVisible(false);
        this.ventureSprites.set(node.ventureId!, building);
        group.add([marker, building]);
      } else if (node.kind === "hub") {
        group.add(this.add.image(0, -2, "guardian-vault").setDisplaySize(74, 52));
      } else {
        const gatewayIndex = gatewayForKind[node.kind] + 1;
        group.add(this.add.image(0, -3, `gateway-${gatewayIndex}`).setDisplaySize(44, 44));
      }
      group.add(text);
      this.board.add(group);
    });
  }

  private setupCamera() {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.input.on("wheel", (_pointer: unknown, _objects: unknown, _dx: number, dy: number) =>
      camera.setZoom(Phaser.Math.Clamp(camera.zoom - dy * 0.001, 0.55, 1.7)),
    );
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.lastPointer = new Phaser.Math.Vector2(pointer.x, pointer.y);
    });
    this.input.on("pointerup", () => (this.dragging = false));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.lastPointer) return;
      camera.scrollX -= (pointer.x - this.lastPointer.x) / camera.zoom;
      camera.scrollY -= (pointer.y - this.lastPointer.y) / camera.zoom;
      this.lastPointer.set(pointer.x, pointer.y);
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const amount = 45 / camera.zoom;
      if (event.key === "ArrowLeft" || event.key === "a") camera.scrollX -= amount;
      if (event.key === "ArrowRight" || event.key === "d") camera.scrollX += amount;
      if (event.key === "ArrowUp" || event.key === "w") camera.scrollY -= amount;
      if (event.key === "ArrowDown" || event.key === "s") camera.scrollY += amount;
      if (event.key === "0") this.fitOverview();
    });
  }

  fitOverview() {
    const camera = this.cameras.main;
    const size = this.scale.gameSize;
    camera.setZoom(Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT) * 0.94);
    camera.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  }

  followPlayer() {
    if (!this.state) return;
    const position = this.pos(this.state.players[this.state.currentPlayer].nodeId);
    this.cameras.main.pan(position.x, position.y, this.state.settings.reducedMotion ? 0 : 400, "Sine.easeInOut");
  }

  setState(state: GameState) {
    this.state = state;
    boardNodes.forEach((node) => {
      if (node.kind !== "venture") return;
      const owner = state.players.find((player) => player.ventures[node.ventureId!]);
      const building = this.ventureSprites.get(node.ventureId!);
      if (!building) return;
      const level = owner?.ventures[node.ventureId!] ?? 0;
      building.setVisible(level > 0);
      if (level > 0) building.setTexture(`venture-level-${level}`).setTint(Phaser.Display.Color.HexStringToColor(owner!.color).color);
    });

    state.players.forEach((player, index) => {
      let token = this.tokens.get(player.id);
      if (!token) {
        const position = this.pos(player.nodeId);
        const halo = this.add.circle(0, 0, 22, Phaser.Display.Color.HexStringToColor(player.color).color, 0.35);
        const texture = index === 0 ? "mascot-token" : `player-token-${Math.min(index + 1, 6)}`;
        const art = this.add.image(0, -18, texture).setDisplaySize(index === 0 ? 48 : 44, index === 0 ? 48 : 44);
        const number = this.add
          .text(16, 8, String(index + 1), {
            fontSize: "11px",
            fontStyle: "bold",
            color: "#080510",
            backgroundColor: player.color,
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5);
        token = this.add.container(position.x, position.y, [halo, art, number]).setDepth(30);
        this.tokens.set(player.id, token);
      } else {
        const position = this.pos(player.nodeId);
        token.setPosition(position.x, position.y);
      }
    });
  }

  async animateRoute(playerId: string, route: number[], reduced: boolean) {
    const token = this.tokens.get(playerId);
    if (!token) return;
    for (const nodeId of route.slice(1)) {
      const position = this.pos(nodeId);
      if (reduced) {
        token.setPosition(position.x, position.y);
        continue;
      }
      await new Promise<void>((resolve) =>
        this.tweens.add({
          targets: token,
          x: position.x,
          y: position.y,
          duration: 260,
          ease: "Sine.InOut",
          onComplete: () => resolve(),
        }),
      );
    }
  }
}
