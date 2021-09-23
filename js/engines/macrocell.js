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

const initCell = (cells, height, x, y) => {
	if (height === 2) {
		const leaf = cellStatesToLeaves.get(cells[y][x]);
		return leaf;
	} else {
		const childHeight = height - 1;
		const offset = 2 ** (height - 3);
		const nw = initCell(cells, childHeight, x, y);
		const ne = initCell(cells, childHeight, x + offset, y);
		const sw = initCell(cells, childHeight, x, y + offset);
		const se = initCell(cells, childHeight, x + offset, y + offset);

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

let originalCells, width, height, size, treeHeight;

const initialize = (data) => {
	({ width, height } = data);
	originalCells = data.cellStates.map((row) => row.concat(Array(width - row.length).fill(CellState.DEAD)));

	size = 1;
	treeHeight = 1;
	const maxDimension = Math.max(width, height);
	while (size < maxDimension) {
		size <<= 1;
		treeHeight++;
	}

	const cells = originalCells;
	ids = 0;
	topCell = initCell(cells, treeHeight, 0, 0);
	postDebug(ids, topCell);
	return [];
};

const reset = (saveData) => {
	// TODO
};

const update = () => {
	// TODO
};

const render = (headIDs, tailIDs) => {
	// TODO
};

buildEngine(oldThemes["currant"], initialize, reset, update, render);
