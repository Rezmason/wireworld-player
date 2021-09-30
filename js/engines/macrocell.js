importScripts("engine_common.js");

const cellTemplate = {
	nw: null,
	ne: null,
	sw: null,
	se: null,
	result: null,
	state: -1,
	id: -1,
	depth: 0,
};

const cache = new Map();
const cellStatesToLeaves = new Map(Object.values(CellState).map((state) => [state, { ...cellTemplate, state, id: -state }]));

let topCell = null;
let ids = 0;

let originalCells, width, height, size, treeDepth;
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
	treeDepth = 0;
	const maxDimension = Math.max(width, height);
	while (size < maxDimension * 2) {
		size <<= 1;
		treeDepth++;
	}

	return cellGridIndices;
};

const lookup = (nw, ne, sw, se) => {
	const key = `${nw.id},${ne.id},${sw.id},${se.id}`;
	if (!cache.has(key)) {
		const cell = {
			...cellTemplate,
			depth: nw.depth + 1,
			id: ids++,
			nw,
			ne,
			sw,
			se,
		};
		cache.set(key, cell);
	}
	return cache.get(key);
};

const initCell = (cells, savedHeadIDs, savedTailIDs, depth, x, y) => {
	if (depth === 0) {
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
		const childDepth = depth - 1;
		const offset = 2 ** childDepth;
		const nw = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x, y);
		const ne = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x + offset, y);
		const sw = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x, y + offset);
		const se = initCell(cells, savedHeadIDs, savedTailIDs, childDepth, x + offset, y + offset);
		return lookup(nw, ne, sw, se);
	}
};

const reset = (saveData) => {
	const savedHeadIDs = saveData != null ? new Set(saveData.headIDs) : null;
	const savedTailIDs = saveData != null ? new Set(saveData.tailIDs) : null;

	ids = 0;
	// TODO: empty cache
	const centerCell = initCell(originalCells, savedHeadIDs, savedTailIDs, treeDepth - 1, 0, 0);
	const vacuum = initCell([], null, null, treeDepth - 2, 0, 0);

	// prettier-ignore
	const [
			/*V*//*V*//*V*//*V*/
			/*V*/ nw,  ne, /*V*/
			/*V*/ sw,  se, /*V*/
			/*V*//*V*//*V*//*V*/
	] = [
		lookup(vacuum, vacuum, vacuum, centerCell.nw),
		lookup(vacuum, vacuum, centerCell.ne, vacuum),
		lookup(vacuum, centerCell.sw, vacuum, vacuum),
		lookup(centerCell.se, vacuum, vacuum, vacuum),
	];
	topCell = lookup(nw, ne, sw, se);
};

const update = () => {
	// TODO
};

const renderCell = (headIDs, tailIDs, cell, x, y) => {
	if (cell.depth === 0) {
		switch (cell.state) {
			case CellState.HEAD:
				headIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
			case CellState.TAIL:
				tailIDs.push(cellIDsByGridIndex[y * width + x]);
				break;
		}
	} else {
		const offset = 2 ** (cell.depth - 1);
		renderCell(headIDs, tailIDs, cell.nw, x, y);
		renderCell(headIDs, tailIDs, cell.ne, x + offset, y);
		renderCell(headIDs, tailIDs, cell.sw, x, y + offset);
		renderCell(headIDs, tailIDs, cell.se, x + offset, y + offset);
	}
};

const render = (headIDs, tailIDs) => {
	renderCell(headIDs, tailIDs, topCell, -size / 4, -size / 4);
};

buildEngine(oldThemes["currant"], initialize, reset, update, render);
