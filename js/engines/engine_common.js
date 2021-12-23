const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const themes = {
	["default"]: [0x000000ff, 0x505050ff, 0xff8800ff, 0xffee00ff], // Orange and yellow over grey and black
	classic: [0x000000ff, 0xff8800ff, 0x2c82f6ff, 0xffffffff], // White and blue over orange and black
	minty: [0x000000ff, 0x505050ff, 0x00c000ff, 0x80ff80ff], // Spearmint over grey and black
	bright: [0x000000ff, 0x404040ff, 0x909090ff, 0xffffffff], // White and grey over grey and black

	tamarind: [0x440800ff, 0xbb4411ff, 0xff8822ff, 0xffddaaff], // brown, red, orange
	gourd: [0x081100ff, 0x669911ff, 0x99cc44ff, 0xffffaaff], // green and yellow
	aubergine: [0x0f001eff, 0x443366ff, 0x448800ff, 0xaaff33ff], // purple and green
	frigid: [0x001144ff, 0x336688ff, 0x33ddffff, 0xffffffff], // blue, cyan and white
	coffee: [0x100400ff, 0x664422ff, 0xbbaa99ff, 0xffeeccff], // brown and white
	regal: [0x10050aff, 0xd09911ff, 0xffee88ff, 0xffffffff], // dark purple and gold
	birthday: [0x770511ff, 0xee6688ff, 0xffaabbff, 0xffffddff], // fuschia, pink and buttercream
};

let mainPort;
let delegatePorts;

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

		mainPort.postMessage({
			type: "initializePaper",
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
		mainPort.postMessage({
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

		mainPort.postMessage({
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

	self.addEventListener("message", ({ data }) => {
		if (data.type == "channel") {
			mainPort = data.mainPort;
			mainPort.addEventListener("message", ({ data }) => {
				api[data.type]?.(...(data.args ?? []));
			});
			mainPort.start();
			delegatePorts = data.delegatePorts ?? {};
			for (const name in delegatePorts) {
				const port = delegatePorts[name];
				port.addEventListener("message", ({ data }) => {
					postDebug("Data from delegate: ", data);
				});
				port.start();
			}
		}
	});
};

const postDebug = (...args) => {
	mainPort.postMessage({ type: "debug", args });
};
