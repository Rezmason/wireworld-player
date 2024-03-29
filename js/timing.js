const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let playing = false;
let speed = 1;
let delayMS = minDelayMS;
let turbo = false;
let animationFrameID;
let timeoutID;
let forceNextAdvance = true;

let _advance, _startTurbo, _stopTurbo;

const initialize = (advance, startTurbo, stopTurbo) => {
	_advance = advance;
	_startTurbo = startTurbo;
	_stopTurbo = stopTurbo;
};

const setRhythm = (rhythmData, engineReset = false) => {
	const wasPlaying = playing;
	const wasTurbo = turbo && !engineReset;
	({ playing, speed, turbo } = rhythmData);
	recomputeDelayMS();

	if (playing && !wasPlaying) {
		if (turbo) {
			_startTurbo();
		} else {
			forceNextAdvance = true;
			run();
		}
	} else if (!playing && wasPlaying) {
		if (turbo) {
			_stopTurbo();
		} else {
			stop();
		}
	} else if (playing) {
		if (turbo && !wasTurbo) {
			_startTurbo();
			stop();
		} else if (!turbo && wasTurbo) {
			_stopTurbo();
			forceNextAdvance = true;
			run();
		}
	}
};

const recomputeDelayMS = () => {
	const x = Math.pow(speed, 1 / 5);
	delayMS = minDelayMS * x + maxDelayMS * (1 - x);
};

const stop = () => {
	cancelAnimationFrame(animationFrameID);
	animationFrameID = null;
	clearTimeout(timeoutID);
	timeoutID = null;
};

const run = () => {
	_advance(forceNextAdvance, Date.now());
	forceNextAdvance = false;
	if (playing) {
		if (speed >= 1) {
			animationFrameID = requestAnimationFrame(run);
		} else {
			timeoutID = setTimeout(run, delayMS);
		}
	}
};

const timing = { initialize, setRhythm };

export { timing };
