import { getDefaultURL } from "./data.js";
import { delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { parseFile } from "./parse.js";
import { engine } from "./engine.js";

const params = new URL(document.location).searchParams;
const suppressSplash = params.has("nosplash");

let data;

gui.events.addEventListener("statechanged", () => {
	engine.setRhythm(gui.state);
});

gui.events.addEventListener("advance", () => {
	engine.advance();
});

gui.events.addEventListener("resetsim", () => {
	engine.reset();
});

gui.events.addEventListener("load", () => {
	load(gui.state.file ?? gui.state.url, false);
});

const load = async (target, splash) => {
	let filename;
	try {
		if (splash && !suppressSplash) {
			gui.showAboutPopup(true);
		}

		const popupPromise = delay(splash ? 2 : 1);
		const isFile = target instanceof File;
		filename = isFile ? target.name : target.split("/").pop();
		const key = isFile ? `__local__${target.name}_${target.lastModified}` : target;
		data = parseFile(await (isFile ? fetchLocalText : fetchRemoteText)(target));

		gui.reset(filename);
		gui.initializePaper(data);
		engine.initialize(data, gui.updatePaper);
		if (!splash || !suppressSplash) {
			await popupPromise;
			if (splash) {
				gui.hideAboutPopup();
			} else {
				gui.hideLoadingPopup();
			}
		}
	} catch (error) {
		console.log(error);
		gui.showErrorPopup(`Load failed.`, `Couldn't load "${filename ?? "file"}".`, error.message);
	}
};

const isPortrait = (screen.orientation?.type ?? "landscape-primary").startsWith("portrait");

const defaultURL = getDefaultURL(isPortrait);

load(defaultURL, true);
