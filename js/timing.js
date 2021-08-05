const minDelayMS = 10; // TODO: ought to be pinned to the RAF delay
const maxDelayMS = 1000;

let playing = false,
	speed = 1,
	delayMS = minDelayMS,
	turbo = false,
	timeoutID;

let _advance;

const initialize = (advance) => {
	_advance = advance;
};

const setRhythm = (rhythmData) => {
	const wasPlaying = playing;
	const wasTurbo = turbo;
	({ playing, speed, turbo } = rhythmData);
	recomputeDelayMS();
	if (playing && !wasPlaying) {
		run();
	}
};

const recomputeDelayMS = () => {
	const x = Math.pow(speed, 1 / 5);
	delayMS = minDelayMS * x + maxDelayMS * (1 - x);
};

const run = () => {
	_advance?.();
	if (playing) {
		if (speed >= 1) {
			requestAnimationFrame(run);
		} else {
			timeoutID = setTimeout(run, delayMS);
		}
	}
};

const timing = { initialize, setRhythm };

export { timing };
