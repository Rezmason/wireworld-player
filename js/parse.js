import { CellState } from "./data.js";

const maxLength = 2048; // TODO: base this on something, anything

const txtCharsToStates = {
	[" "]: CellState.DEAD,
	["#"]: CellState.WIRE,
	["~"]: CellState.TAIL,
	["@"]: CellState.HEAD,
};

const mclCharsToStates = {
	["."]: CellState.DEAD,
	["A"]: CellState.HEAD,
	["B"]: CellState.TAIL,
	["C"]: CellState.WIRE,
};

const parseTXT = (file) => {
	const data = file.match(/^(\d+) +(\d+)\s*/);

	if (data == null) {
		return null;
	}

	const cellStates = file.split("\n").map((line) => [...line].map((c) => txtCharsToStates[c] ?? CellState.DEAD));

	return {
		width: parseInt(data[1]),
		height: parseInt(data[2]),
		cellStates,
	};
};

const parseMCL = (file) => {
	const data = file.match(/^#MCell.*#BOARD (\d+)x(\d+).*?(#L.*)/ms);

	if (data == null) {
		return null;
	}

	const cellStates = data[3]
		.replace(/(#L |\$$|\r)/g, "")
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => line.match(/([0-9]+)?([^\d])/g).map((c) => "".padStart(c.length == 1 ? 1 : parseInt(c), c[c.length - 1])))
		.flat()
		.join("")
		.split("$")
		.map((line) => [...line].map((c) => mclCharsToStates[c] ?? CellState.DEAD));

	return {
		width: Math.max(...cellStates.map((line) => line.length)) /*parseInt(data[1])*/,
		height: cellStates.length /*parseInt(data[2])*/,
		cellStates,
	};
};

const parseFile = (file) => {
	const data = parseMCL(file) ?? parseTXT(file);
	if (data == null) throw new Error("Unrecognized file format.");
	if (data.width > maxLength) throw new Error(`Width exceeds ${maxLength}`);
	if (data.height > maxLength) throw new Error(`Height exceeds ${maxLength}`);
	return data;
};

export { parseFile };
