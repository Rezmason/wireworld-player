const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const oldThemes = {
	["default"]: [0x000000ff, 0x505050ff, 0xffee00ff, 0xff8800ff],
	classic: [0x000000ff, 0xff8800ff, 0xffffffff, 0x2c82f6ff],
	minty: [0x000000ff, 0x505050ff, 0x80ff80ff, 0x00c000ff],
	bubbleGum: [0x000000ff, 0x4c4c4cff, 0xff4cffff, 0xff4c4cff],
	brass: [0x101000ff, 0x404020ff, 0xffff20ff, 0x808020ff],
	freon: [0x000000ff, 0x4c4c4cff, 0x4cffffff, 0x4c4cffff],
	currant: [0x000000ff, 0x300050ff, 0xffff00ff, 0x8000a0ff],
	night: [0x000040ff, 0x4040a0ff, 0xffffddff, 0x8080ddff],
	gleam: [0x000000ff, 0xffff00ff, 0xffffffff, 0xfffff80ff],
	bright: [0x000000ff, 0x404040ff, 0xffffffff, 0x909090ff],
};

const headIDs = [];
const tailIDs = [];

const numberFormatter = new Intl.NumberFormat();
const maxFrameTime = 1000 / 10;
const desiredFrameTime = 1000 / 60;

let width, height, generation;

let turboActive = false;
let turboStepSize = 1;
let turboTimeout = null;

let lastTurboTime, lastTurboGeneration;
const turboHistoryLength = 10;
const turboHistory = Array(turboHistoryLength);
let turboHistoryIndex = 0;
let turboAverageSpeed = 0;

class Engine {
	constructor(theme) {
		this.theme = theme;
		const api = {
			initialize: this.initialize.bind(this),
			advance: this.advance.bind(this),
			reset: this.reset.bind(this),
			startTurbo: this.startTurbo.bind(this),
			stopTurbo: this.stopTurbo.bind(this),
		};

		self.addEventListener("message", ({ data }) => api[data.type]?.(...(data.args ?? [])));
	}

	initialize(data, restoredRender = null) {
		width = data.width;
		height = data.height;

		const cellGridIndices = this._initialize(data, restoredRender);

		postMessage({
			type: "setup",
			args: [
				{
					width,
					height,
					cellGridIndices,
					theme: this.theme,
				},
			],
		});

		cellGridIndices.length = 0;

		this.reset(restoredRender);
	}

	reset(restoredRender) {
		generation = restoredRender?.generation ?? 0;
		this._reset(restoredRender);
		this.resetTurboHistory();
		this.render();
	}

	update() {
		generation++;
		this._update();
	}

	render() {
		headIDs.length = 0;
		tailIDs.length = 0;

		this._render(headIDs, tailIDs);

		let simulationSpeed = "---";
		if (turboActive) {
			const now = Date.now();
			const speed = (generation - lastTurboGeneration) / (now - lastTurboTime);
			turboAverageSpeed -= turboHistory[turboHistoryIndex] / turboHistoryLength;
			turboHistory[turboHistoryIndex] = speed;
			turboAverageSpeed += speed / turboHistoryLength;
			turboHistoryIndex = (turboHistoryIndex + 1) % turboHistoryLength;
			simulationSpeed = numberFormatter.format(Math.round(1000 * turboAverageSpeed));
		}

		postMessage({
			type: "render",
			args: [
				{
					generation: numberFormatter.format(generation),
					simulationSpeed,
					width,
					height,
					headIDs,
					tailIDs,
				},
			],
		});
	}

	advance() {
		this.update();
		this.render();
	}

	startTurbo() {
		turboActive = true;
		let now = Date.now();
		let lastUpdate = now;
		let lastRender = now;
		this.resetTurboHistory();

		const update = this.update.bind(this);

		const loopTurbo = () => {
			for (let i = 0; i < turboStepSize; i++) {
				update();
				update();
				update();
				update();
				update();
				update();
			}

			now = Date.now();

			const diff = now - lastUpdate;
			if (diff > maxFrameTime && turboStepSize > 1) {
				turboStepSize >>= 1;
			} else if (diff * 2 < maxFrameTime) {
				turboStepSize <<= 1;
			}
			lastUpdate = now;

			if (now - lastRender > desiredFrameTime) {
				lastRender = now;
				this.render();
			}

			turboTimeout = setTimeout(loopTurbo, 0);
		};
		loopTurbo();
	}

	stopTurbo() {
		turboActive = false;
		clearTimeout(turboTimeout);
		turboTimeout = null;
	}

	resetTurboHistory() {
		lastTurboTime = Date.now();
		lastTurboGeneration = generation;
		turboHistory.fill(0);
		turboHistoryIndex = 0;
		turboAverageSpeed = 0;
	}
}
