import { CellState } from "./data.js";

const maxLength = 2048; // TODO: base this on something, anything

const txtCharsToStates = {
	[" "]: CellState.DEAD,
	["#"]: CellState.WIRE,
	["~"]: CellState.TAIL,
	["@"]: CellState.HEAD
};

const mclCharsToStates = {
	["."]: CellState.DEAD,
	["A"]: CellState.TAIL,
	["B"]: CellState.HEAD,
	["C"]: CellState.WIRE
};

const parseTXT = file => {
	const data = file.match(/^(\d+) +(\d+)\s*/);

	if (data == null) {
		return null;
	}

	const cells = file.split("\n").map(line => [...line].map(c => txtCharsToStates[c] ?? CellState.DEAD));

	return {
		width: parseInt(data[1]),
		height: parseInt(data[2]),
		cells
	};
};

const parseMCL = file => {
	const data = file.match(/^#MCell.*#BOARD (\d+)x(\d+).*?(#L.*)/ms);

	if (data == null) {
		return null;
	}

	const lines = data[3]
		.replace(/(#L |\$$|\r)/g, "")
		.split("\n")
		.filter(line => line.length > 0);

	//*
	const txtFile = lines
		.map(line => line.match(/([0-9]+)?([^\d])/g).map(c => "".padStart(c.length == 1 ? 1 : parseInt(c), c[c.length - 1])))
		.flat()
		.join("");
	/* A1 */

	/*
	let txtFile = "";
	let digitString = "";
	const numLines = lines.length;
	for (let i = 0; i < numLines; i++) {
		const line = lines[i];
		const length = line.length;
		for (let j = 0; j < length; j++) {
			const char = line[j];
			if (char >= "0" && char <= "9") {
				digitString += char;
			} else if (char in mclCharsToStates || char === "$") {
				const count = digitString.length ? parseInt(digitString) : 1;
				digitString = "";
				for (let k = 0; k < count; k++) {
					txtFile += char;
				}
			}
		}
	}
	/* B1 */

	//*
	const cells = txtFile
		.split("$")
		.map(line => [...line].map(c => mclCharsToStates[c] ?? CellState.DEAD));
	/* A2 */

	/*
	const lines2 = txtFile.split("$");
	const numRows = lines2.length;
	const cells = Array(lines2.length);
	for (let i = 0; i < numRows; i++) {
		const line = lines2[i];
		const length = line.length;
		const row = [];
		cells[i] = row;
		for (let j = 0; j < length; j++) {
			row[j] = c => mclCharsToStates[c] ?? CellState.DEAD;
		}
	}
	/* B2 */

	return {
		width: Math.max(...cells.map(line => line.length)) /*parseInt(data[1])*/,
		height: cells.length /*parseInt(data[2])*/,
		cells
	};
};

export default file => {
	const data = parseMCL(file) ?? parseTXT(file);
	if (data == null) throw new Error("Unrecognized file format.");
	if (data.width > maxLength) throw new Error(`Width exceeds ${maxLength}`);
	if (data.height > maxLength) throw new Error(`Height exceeds ${maxLength}`);
	return data;
};
