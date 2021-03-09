import { defaultLandscapeFilePath, defaultPortraitFilePath } from "./data.js";
import gui from "./gui.js";
import parseFile from "./parse.js";

let data;

const load = async path => {
	gui.setFilePath(path.split("/").pop());
	const file = await fetch(path);
	if (!file.ok) {
		throw new Error(`${file.status}: ${file.statusText}`);
	}
	data = await parseFile(await file.text());
	gui.setPaper(data);
};

const listen = (name, func) => gui.events.addEventListener(name, func);

listen("stop", _ => _);
listen("play_pause", _ => _);
listen("step", _ => _);

listen("overdrive", _ => _);

listen("snapshot", _ => _);
listen("help", _ => _);
listen("about", _ => _);

listen("load", _ => _);

const init = async () => {
	// TODO: show splash screen

	const isPortrait = (
		screen.orientation?.type ?? "landscape-primary"
	).startsWith("portrait");
	// const path = isPortrait ? defaultPortraitFilePath : defaultLandscapeFilePath;

	// const path = "examples/mcl/owen_moore/computer_by_mark_owen_vertical.mcl";
	const path = "examples/mcl/owen_moore/computer_by_mark_owen_horizontal.mcl";

	try {
		await load(path);
	} catch (error) {
		console.log(error);
		return;
	}

	// TODO: hide splash screen
};

init();
