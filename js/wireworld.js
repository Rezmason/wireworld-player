import { getDefaultURL } from "./data.js";
import { delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { parseFile } from "./parse.js";
import { timing } from "./timing.js";

const params = new URL(document.location).searchParams;
const suppressSplash = params.has("nosplash");
const engine = new Worker("./js/engine.js");

let queuedRender = null;
const checkRenderQueue = () => {
	if (queuedRender != null) {
		gui.updatePaper(...queuedRender);
		queuedRender = null;
	}
	requestAnimationFrame(checkRenderQueue);
};
checkRenderQueue();

engine.addEventListener("message", (event) => {
	switch (event.data.type) {
		case "render":
			queuedRender = event.data.args;
			break;
	}
});

let data;

timing.initialize(() => engine.postMessage({ type: "advance" }));

gui.events.addEventListener("statechanged", () => {
	timing.setRhythm(gui.state);
});

gui.events.addEventListener("advance", () => {
	engine.postMessage({ type: "advance" });
});

gui.events.addEventListener("resetsim", () => {
	engine.postMessage({ type: "reset" });
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
		engine.postMessage({ type: "initialize", args: [data] });
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
