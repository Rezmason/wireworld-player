const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const oldThemes = {
	["default"]: [0x000000ff, 0x505050ff, 0xff8800ff, 0xffee00ff],
	classic: [0x000000ff, 0xff8800ff, 0x2c82f6ff, 0xffffffff],
	minty: [0x000000ff, 0x505050ff, 0x00c000ff, 0x80ff80ff],
	bubbleGum: [0x000000ff, 0x4c4c4cff, 0xff4c4cff, 0xff4cffff],
	brass: [0x101000ff, 0x404020ff, 0x808020ff, 0xffff20ff],
	freon: [0x000000ff, 0x4c4c4cff, 0x4c4cffff, 0x4cffffff],
	currant: [0x000000ff, 0x300050ff, 0x8000a0ff, 0xffff00ff],
	night: [0x000040ff, 0x4040a0ff, 0x8080ddff, 0xffffddff],
	gleam: [0x000000ff, 0xffff00ff, 0xfffff80ff, 0xffffffff],
	bright: [0x000000ff, 0x404040ff, 0x909090ff, 0xffffffff],

	paprika: [0x330800ff, 0xff6600ff, 0xffaa00ff, 0xffffffff],
	gourd: [0x081100ff, 0x88aa33ff, 0xccff33ff, 0xffffaaff],
	aubergine: [0x040008ff, 0x443366ff, 0x448800ff, 0xaaff33ff],
};

const buildEngine = (theme, _initialize, _reset, _update, _render) => {
	const headIDs = [];
	const tailIDs = [];
	let originalData, cellGridIndices;

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

	const maxThreadDelay = 1000 / 30;

	const initialize = (data) => {
		originalData = data;
		width = data.width;
		height = data.height;

		cellGridIndices = _initialize(data);

		postMessage({
			type: "setup",
			args: [
				{
					width,
					height,
					cellGridIndices,
					theme: theme,
					isRestore: data.saveData != null,
				},
			],
		});

		const idsByCellGridIndex = new Map(cellGridIndices.map((x, i) => [x, i]));
		const saveData =
			data.saveData == null
				? null
				: {
						...data.saveData,
						headIDs: data.saveData.headGridIndices.map((gridIndex) => idsByCellGridIndex.get(gridIndex)),
						tailIDs: data.saveData.tailGridIndices.map((gridIndex) => idsByCellGridIndex.get(gridIndex)),
				  };

		reset(saveData);
	};

	const save = () => {
		postMessage({
			type: "saveData",
			args: [
				{
					...originalData,
					saveData: {
						generation,
						headGridIndices: headIDs.map((id) => cellGridIndices[id]),
						tailGridIndices: tailIDs.map((id) => cellGridIndices[id]),
					},
				},
			],
		});
	};

	const reset = (saveData) => {
		generation = saveData?.generation ?? 0;
		_reset(saveData);
		resetTurboHistory();
		render();
	};

	const update = () => {
		const step = _update(generation) ?? 1;
		generation += step;
	};

	const render = () => {
		headIDs.length = 0;
		tailIDs.length = 0;

		_render(headIDs, tailIDs);

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
	};

	const advance = (force, mainThreadTime) => {
		if (force || Date.now() - mainThreadTime < maxThreadDelay) {
			update();
			render();
		}
	};

	const startTurbo = () => {
		turboActive = true;
		let now = Date.now();
		let lastUpdate = now;
		let lastRender = now;
		resetTurboHistory();

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
				render();
			}

			turboTimeout = setTimeout(loopTurbo, 0);
		};
		loopTurbo();
	};

	const stopTurbo = () => {
		turboActive = false;
		clearTimeout(turboTimeout);
		turboTimeout = null;
	};

	const resetTurboHistory = () => {
		lastTurboTime = Date.now();
		lastTurboGeneration = generation;
		turboHistory.fill(0);
		turboHistoryIndex = 0;
		turboAverageSpeed = 0;
	};

	const api = {
		initialize,
		advance,
		reset,
		startTurbo,
		stopTurbo,
		save,
	};

	self.addEventListener("message", ({ data }) => api[data.type]?.(...(data.args ?? [])));
};

const postDebug = (...args) => postMessage({ type: "debug", args });
