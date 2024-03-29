const CellState = Object.fromEntries(["HEAD", "TAIL", "WIRE", "DEAD"].map((name, index) => [name, index]));

const buildEngine = (_load, _reset, _update, _render) => {
	const headIDs = [];
	const tailIDs = [];
	let name;
	let originalData, cellGridIndices, idsByCellGridIndex;
	let transferredCellGridIndices;
	let transferredTurboSpeed = 0;
	let slow = false;

	const maxFrameTime = 1000 / 10;
	const desiredFrameTime = 1000 / 60;

	let width, height, generation;

	let turboActive = false;
	let turboStepSize = 1;
	let turboInterval = null;

	let lastTurboTime, lastTurboGeneration;
	const turboHistoryLength = 6;
	const turboHistory = Array(turboHistoryLength);
	let turboHistoryIndex = 0;
	let turboAverageSpeed = 0;

	const maxThreadDelay = 1000 / 30;

	const initialize = (engineName) => {
		name = engineName;
	};

	const load = (data) => {
		originalData = data;
		width = data.width;
		height = data.height;

		cellGridIndices = _load(data);

		postMessage({
			type: "initializePaper",
			args: [
				{
					name,
					width,
					height,
					cellGridIndices,
					isRestore: data.saveData != null,
				},
			],
		});

		idsByCellGridIndex = new Map(cellGridIndices.map((x, i) => [x, i]));
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
		if (slow) {
			return;
		}
		const stats = _update(generation);
		generation += stats?.step ?? 1;
		slow ||= stats?.slow ?? false;
	};

	const render = () => {
		headIDs.length = 0;
		tailIDs.length = 0;

		_render(headIDs, tailIDs);

		let turboSpeed = 0;
		if (turboActive && transferredCellGridIndices != null) {
			const now = Date.now();
			const speed = (generation - lastTurboGeneration) / (now - lastTurboTime);
			turboAverageSpeed -= turboHistory[turboHistoryIndex] / turboHistoryLength;
			turboHistory[turboHistoryIndex] = speed;
			turboAverageSpeed += speed / turboHistoryLength;
			turboHistoryIndex = (turboHistoryIndex + 1) % turboHistoryLength;
			turboSpeed = turboAverageSpeed;
		}

		turboSpeed = Math.max(turboSpeed, transferredTurboSpeed);

		postMessage({
			type: "render",
			args: [
				{
					name,
					slow,
					generation,
					turboSpeed,
					width,
					height,
					headIDs,
					tailIDs,
				},
			],
		});
	};

	const advance = (force, mainThreadTime) => {
		slow = false;
		if (force || Date.now() - mainThreadTime < maxThreadDelay) {
			update();
			render();
		}
	};

	const startTurbo = () => {
		turboActive = true;
		resetTurboHistory();
		turboInterval = setInterval(loopTurbo, 0);
		loopTurbo();
	};

	const loopTurbo = () => {
		slow = false;
		const loopStart = Date.now();
		for (let i = 0; i < turboStepSize; i++) {
			update();
			update();
			update();
			update();
			update();
			update();
		}
		const diff = Date.now() - loopStart;
		if (diff > maxFrameTime && turboStepSize > 1) {
			turboStepSize >>= 1;
		} else if (diff * 2 < maxFrameTime) {
			turboStepSize <<= 1;
		}

		if (diff > desiredFrameTime * 3) {
			slow = true;
		}

		if (diff > desiredFrameTime) {
			render();
		}
	};

	const stopTurbo = () => {
		turboActive = false;
		clearTimeout(turboInterval);
		turboInterval = null;
	};

	const resetTurboHistory = () => {
		lastTurboTime = Date.now();
		lastTurboGeneration = generation;
		turboHistory.fill(0);
		turboHistoryIndex = 0;
		turboAverageSpeed = 0;
		transferredTurboSpeed = 0;
	};

	const initTransfer = (cellGridIndices) => {
		transferredCellGridIndices = cellGridIndices;
	};

	const transfer = (saveData) => {
		generation = saveData.generation ?? 0;
		transferredTurboSpeed = saveData.turboSpeed;
		_reset({
			...saveData,
			headIDs: saveData.headIDs.map((id) => idsByCellGridIndex.get(transferredCellGridIndices[id])),
			tailIDs: saveData.tailIDs.map((id) => idsByCellGridIndex.get(transferredCellGridIndices[id])),
		});
		render();
	};

	const api = {
		initialize,
		load,
		advance,
		reset,
		startTurbo,
		stopTurbo,
		save,

		initTransfer,
		transfer,
	};

	self.addEventListener("message", ({ data }) => api[data.type]?.(...(data.args ?? [])));
};

const postDebug = (...args) => postMessage({ type: "debug", args });
