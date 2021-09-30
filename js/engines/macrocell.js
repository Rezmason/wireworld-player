importScripts("engine_common.js");

const cellTemplate = {
	nw: null,
	ne: null,
	sw: null,
	se: null,
	result: null,
	state: null,
	id: null,
};

const cache = new Map();
const cellStatesToLeaves = new Map(Object.values(CellState).map((state) => [state, { ...cellTemplate, state, id: -state }]));

let topCell = null;
let ids = 0;

let originalCells, width, height, size, treeHeight;
const cellIDsByGridIndex = [];

const initialize = (data) => {
	({ width, height } = data);
	cellIDsByGridIndex.length = 0;
	let numCells = 0;
	const cellGridIndices = [];
	originalCells = data.cellStates.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const state = originalCells[y][x];
			if (state !== CellState.DEAD) {
				cellIDsByGridIndex[y * width + x] = numCells;
				cellGridIndices.push(y * width + x);
				numCells++;
			}
		}
	}

	size = 1;
	treeHeight = 0;
	const maxDimension = Math.max(width, height);
	while (size < maxDimension) {
		size <<= 1;
		treeHeight++;
	}

	return cellGridIndices;
};

const initCell = (cells, savedHeadIDs, savedTailIDs, height, x, y) => {
	if (height === 0) {
		let state = cells[y]?.[x] ?? CellState.DEAD;

		if (savedHeadIDs != null && state !== CellState.DEAD) {
			const cellID = cellIDsByGridIndex[y * width + x];
			state = CellState.WIRE;
			if (savedHeadIDs.has(cellID)) {
				state = CellState.HEAD;
			}
			if (savedTailIDs.has(cellID)) {
				state = CellState.TAIL;
			}
		}

		const leaf = cellStatesToLeaves.get(state);
		return leaf;
	} else {
		const childHeight = height - 1;
		const offset = 2 ** childHeight;
		const nw = initCell(cells, savedHeadIDs, savedTailIDs, childHeight, x, y);
		const ne = initCell(cells, savedHeadIDs, savedTailIDs, childHeight, x + offset, y);
		const sw = initCell(cells, savedHeadIDs, savedTailIDs, childHeight, x, y + offset);
		const se = initCell(cells, savedHeadIDs, savedTailIDs, childHeight, x + offset, y + offset);

		const key = `${nw.id},${ne.id},${sw.id},${se.id}`;
		if (!cache.has(key)) {
			const cell = {
				...cellTemplate,
				id: ids++,
				nw,
				ne,
				sw,
				se,
				// result?
			};
			cache.set(key, cell);
		}
		return cache.get(key);
	}
};

const reset = (saveData) => {
	const savedHeadIDs = saveData != null ? new Set(saveData.headIDs) : null;
	const savedTailIDs = saveData != null ? new Set(saveData.tailIDs) : null;

	const cells = originalCells;
	ids = 0;
	// TODO: empty cache
	topCell = initCell(cells, savedHeadIDs, savedTailIDs, treeHeight, 0, 0);
	postDebug(ids, topCell);
};

const update = () => {
	// TODO
};

const renderCell = (headIDs, tailIDs, cell, height, x, y) => {
	if (height === 0) {
		const state = cell.state;
		switch (state) {
			case CellState.HEAD:
				headIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
			case CellState.TAIL:
				tailIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
		}
	} else {
		const childHeight = height - 1;
		const offset = 2 ** childHeight;
		renderCell(headIDs, tailIDs, cell.nw, childHeight, x, y);
		renderCell(headIDs, tailIDs, cell.ne, childHeight, x + offset, y);
		renderCell(headIDs, tailIDs, cell.sw, childHeight, x, y + offset);
		renderCell(headIDs, tailIDs, cell.se, childHeight, x + offset, y + offset);
	}
};

const render = (headIDs, tailIDs) => {
	renderCell(headIDs, tailIDs, topCell, treeHeight, 0, 0);
};

buildEngine(oldThemes["currant"], initialize, reset, update, render);
