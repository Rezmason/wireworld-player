import { getDefaultURL } from "./data.js";
import { delay, fetchLocalText, fetchRemoteText } from "./utils.js";
import { gui } from "./gui.js";
import { paper } from "./paper.js";
import { parseFile } from "./parse.js";
import { timing } from "./timing.js";

const engineFilenamesByName = {
	["default"]: "flat",
	naive: "naive",
	alive: "alive",
	neighbors: "neighbors",
	linked: "linked",
	flat: "flat",
};

const params = new URL(document.location).searchParams;
const suppressSplash = params.has("nosplash");

let engine;
let engineName = params.get("engine") ?? "default";
let queuedRender = null;
let lastRender = null;

const checkRenderQueue = () => {
	if (queuedRender != null) {
		paper.update(queuedRender);
		queuedRender = null;
	}
	requestAnimationFrame(checkRenderQueue);
};
checkRenderQueue();

const handleEngineMessage = (event) => {
	switch (event.data.type) {
		case "setup":
			paper.initialize(event.data.args[0]);
			break;
		case "render":
			if (lastRender != null) {
				for (const prop in lastRender) {
					delete lastRender[prop];
				}
			}
			lastRender = event.data.args[0];
			queuedRender = lastRender;
			break;
		case "debug":
			console.log(...event.data.args);
			break;
	}
};

const rebuildEngine = () => {
	if (engine != null) {
		engine.terminate();
		engine.removeEventListener("message", handleEngineMessage);
	}
	const engineFilename = engineFilenamesByName[engineName] ?? engineFilenamesByName["default"];
	engine = new Worker(`./js/engines/${engineFilename}.js`);
	engine.addEventListener("message", handleEngineMessage);
};

rebuildEngine();

timing.initialize(
	() => engine.postMessage({ type: "advance" }),
	() => engine.postMessage({ type: "startTurbo" }),
	() => engine.postMessage({ type: "stopTurbo" })
);

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
		const data = parseFile(await (isFile ? fetchLocalText : fetchRemoteText)(target));

		gui.reset(filename);
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
