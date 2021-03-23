import { getDefaultURL } from "./data.js";
import { delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import gui from "./gui.js";
import parseFile from "./parse.js";

const params = new URL(document.location).searchParams;
const suppressSplash = params.has("nosplash");

const loadedFiles = new Map();

let data;

gui.events.addEventListener("statechanged", () => {
	// TODO
});

gui.events.addEventListener("advance", () => {
	// TODO
});

gui.events.addEventListener("resetsim", () => {
	// TODO
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
		if (!loadedFiles.has(key)) {
			loadedFiles.set(key, parseFile(await (isFile ? fetchLocalText : fetchRemoteText)(target)));
		}
		data = loadedFiles.get(key);

		gui.reset(filename);
		gui.setPaper(data);
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
