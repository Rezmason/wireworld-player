import { CellState } from "./data.js";

const maxLength = 2048; // TODO: base this on something, anything

const mclCharsToSymbols = {
	["."]: CellState.DEAD,
	["A"]: CellState.TAIL,
	["B"]: CellState.HEAD,
	["C"]: CellState.WIRE
}

const parseTXT = (file) => {
	const data = file.match(/^(\d+) +(\d+)\s*(.*)/ms);

	if (data == null) {
		return null;
	}

	return {
		width: parseInt(data[1]),
		height: parseInt(data[2]),
		cells: data[3]
		.split("\n")
		.map(
			line => line
				.split("")
				.map(char => Symbol.for(char))
		)
	};
};

const parseMCL = (file) => {
	const data = file.match(/^#MCell.*#BOARD (\d+)x(\d+).*?(#L.*)/ms);

	if (data == null) {
		return null;
	}

	const cells = data[3]
		.replace(/(#L |\$$|\r)/g, "")
		.split("\n")
		.filter(line => line.length > 0)
		.map(
			line => line
				.match(/([0-9]+)?([^\d])/g)
				.map(c => Array(c.length == 1 ? 1 : parseInt(c))
					.fill(c[c.length - 1])
				)
		)
		.flat(2)
		.join("")
		.split("$")
		.map(line => line.split("").map(c => mclCharsToSymbols[c]));

	return {
		width: Math.max(...cells.map(line => line.length))/*parseInt(data[1])*/,
		height: cells.length /*parseInt(data[2])*/,
		cells
	}
};

export default async (file) => {
	const data = parseMCL(file) ?? parseTXT(file);
	if (data == null) throw new Error("Unrecognized file format.");
	if (data.width > maxLength) throw new Error(`Width exceeds ${maxLength}`);
	if (data.height > maxLength) throw new Error(`Height exceeds ${maxLength}`);
	return data;
};
