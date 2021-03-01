import { defaultFilePath } from "./data.js";
import gui from "./gui.js";
import parseFile from "./parse.js";

let data;

const load = async (path) => {
	gui.setFilePath(path.split("/").pop());
	const file = await fetch(path);
	if (!file.ok) {
		throw new Error(`${file.status}: ${file.statusText}`);
	}
	data = await parseFile(await file.text());
	gui.setCanvas(data);
}

const init = async () => {

	// TODO: show splash screen

	try {
		await load(defaultFilePath);
	} catch (error) {
		console.log(error);
		return;
	}

	// TODO: hide splash screen
};

init();
