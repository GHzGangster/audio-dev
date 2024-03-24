/**
 * Processes and encodes audio from the microphone for use on the main thread.
 */
const _logPrefix = "\x1b[36m" + "recording_worker ~" + "\x1b[0m";
const log = (message, ...args) => console.log(`${_logPrefix} ${message}`, ...args);
const error = (message, ...args) => console.error(`${_logPrefix} ${message}`, ...args);
const warn = (message, ...args) => console.error(`${_logPrefix} ${message}`, ...args);

const _debugPlay = true;

/**
 * Data for a step.
 * @typedef {Object} StepData
 * @property {string} name
 * @property {Float32Array} buffer
 * @property {number} bufferWriterIndex
 * @property {number} samplesPerFrame
 */

/** @type {StepData} */
const echoStep = {
	name: "echo",
	buffer: new Float32Array(0),
	bufferWriterIndex: 0,
	samplesPerFrame: 0,
};

/** @type {StepData} */
const encodeStep = {
	name: "encode",
	buffer: new Float32Array(0),
	bufferWriterIndex: 0,
	samplesPerFrame: 0,
};

let opus = undefined;

let opusEncoder = 0;
let opusEncodeIn = 0;
const opusEncodeInSize = 48000 * 60 / 1000 * 4; // max 48 Khz, 60 ms, 4 bytes per float
let opusEncodeOut = 0;
const opusEncodeOutSize = 4000; // recommended size in Opus docs

let opusDecoder = 0;
let opusDecodeOut = 0;
const opusDecodeOutSize = 48000 * 120 / 1000 * 4; // max 48 Khz, 120ms, 4 bytes per float

let filter = undefined;
let filterIn = 0;
let filterInEmx = 0;
let filterPlayback = 0;
let filterPlaybackEmx = 0;
let filterOut = 0;
let filterOutEmx = 0;

let playbackBuffer = new Float32Array(0);
let playbackBufferWriterIndex = 0;

self.onerror = (ev) => {
	error("onerror", ev);
};

self.onmessageerror = (ev) => {
	error("onmessageerror", ev);
};

self.onmessage = (ev) => {
	if (ev.data[0] === "start") {
		start(ev.data[1], ev.data[2], ev.data[3]);
	}
};

/**
 *
 * @param {number} sampleRate
 * @param {MessagePort} recordingPort
 * @param {MessagePort} playbackPort
 */
const start = (sampleRate, recordingPort, playbackPort) => {
	log("Starting...");

	playbackBuffer = new Float32Array(sampleRate * 5); // 5 seconds
	playbackBufferWriterIndex = 0;

	echoStep.buffer = new Float32Array(sampleRate * 10); // 10 seconds
	echoStep.bufferWriterIndex = 0;
	echoStep.samplesPerFrame = sampleRate * 60 / 1000; // 60 ms

	if (!filter) {
		error("No Filter context.");
		return;
	}

	filterIn = filter._malloc(echoStep.samplesPerFrame * 4);
	if (filterIn === 0) {
		error("Failed to allocate filterIn.");
		return;
	}

	filterPlayback = filter._malloc(playbackBuffer.length * 4);
	if (filterPlayback === 0) {
		error("Failed to allocate filterPlayback.");
		return;
	}

	filterOut = filter._malloc(echoStep.samplesPerFrame * 4);
	if (filterOut === 0) {
		error("Failed to allocate filterOut.");
		return;
	}

	encodeStep.buffer = new Float32Array(sampleRate * 10); // 10 seconds
	encodeStep.bufferWriterIndex = 0;
	encodeStep.samplesPerFrame = sampleRate * 60 / 1000; // 60 ms

	if (!opus) {
		error("No Opus context.");
		return;
	}

	opusEncoder = opus._opus_encoder_create(sampleRate, 1, 2048 /* OPUS_APPLICATION_VOIP */, 0);
	if (!opusEncoder) {
		error("Failed to create Opus encoder.");
		return;
	}

	opusDecoder = opus._opus_decoder_create(sampleRate, 1, 0);
	if (!opusDecoder) {
		error("Failed to create Opus decoder.");
		return;
	}

	recordingPort.onmessage = processInputFrame;

	playbackPort.onmessage = processPlaybackFrame;

	log("Started.");
};

/**
 *
 * @param {Float32Array} frame
 * @param {StepData} d
 * @param {function(Float32Array)} fn
 */
const handleFrameForStep = (frame, d, fn) => {
	// Optimization
	// if (d.bufferWriterIndex === 0 && frame.length === d.samplesPerFrame) {
	// 	fn(frame);
	// 	return;
	// }

	if (d.bufferWriterIndex + frame.length > d.buffer.length) {
		warn(`handleFrameForStep ${d.name}: Buffer is out of space.`);
		return;
	}

	d.buffer.set(frame, d.bufferWriterIndex);
	d.bufferWriterIndex += frame.length;

	while (d.bufferWriterIndex >= d.samplesPerFrame) {
		const frame = d.buffer.slice(0, d.samplesPerFrame);
		d.buffer.copyWithin(0, d.samplesPerFrame, d.bufferWriterIndex);
		d.bufferWriterIndex -= d.samplesPerFrame;

		fn(frame);
	}
};

/**
 *
 * @param {MessageEvent} ev
 */
const processInputFrame = (ev) => {
	handleFrameForStep(ev.data, echoStep, handleFrameForEcho);
};

/**
 * Runs echo processing step.
 *
 * Emx structure reference:
 *
 * struct emxArray_real_T
 * {
 * 	0x00 double *data;
 * 	0x04 int *size;
 * 	0x08 int allocatedSize;
 * 	0x0c int numDimensions;  1
 * 	0x10 boolean_T canFreeData;  0
 * };
 * ...
 * 0x14 size[0]  1
 * 0x18 size[1]  ex 128
 * 0x1c (end)
 *
 * @param {Float32Array} frame
 */
const handleFrameForEcho = (frame) => {
	// Set up in emx
	filter.HEAPF32.set(frame, filterIn / 4);
	filter.HEAPU32.set([filterIn, filterInEmx + 0x14, frame.length, 1, 0, 1, frame.length], filterInEmx / 4);

	// Set up playback emx
	filter.HEAPF32.set(playbackBuffer, filterPlayback / 4);
	filter.HEAPU32.set([filterPlayback, filterPlaybackEmx + 0x14, playbackBufferWriterIndex, 1, 0, 1,
		playbackBufferWriterIndex], filterPlaybackEmx / 4);

	// Set up out emx
	filter.HEAPF32.set(frame, filterOut / 4);
	filter.HEAPU32.set([filterOut, filterOutEmx + 0x14, frame.length, 1, 0, 1, frame.length], filterOutEmx / 4);

	// Run filter
	filter._myFilterLP_initialize();
	filter._myFilterLP(filterInEmx, filterPlaybackEmx, filterOutEmx);
	filter._myFilterLP_terminate();

	// Get result
	const filterOutSize = filter.HEAPU32[(filterOutEmx + 0x18) / 4];
	const filterOutData = filter.HEAPF32.slice(filterOut / 4, filterOut / 4 + filterOutSize);

	// Debug
	const filterInput = frame.slice();
	const filterOutput = filterOutData.slice();
	self.postMessage(["filterDebug", filterInput, filterOutput], [filterInput.buffer, filterOutput.buffer]);

	handleFrameForStep(filterOutData, encodeStep, handleFrameForEncode);
};

/**
 *
 * @param {Float32Array} frame
 */
const handleFrameForEncode = (frame) => {
	if (!opusEncodeIn || !opusEncodeOut) {
		return;
	}

	opus.HEAPF32.set(frame, opusEncodeIn / 4);
	let result = opus._opus_encode_float(opusEncoder, opusEncodeIn, frame.length, opusEncodeOut, opusEncodeOutSize);
	if (result < 0) {
		error(`Failed to Opus encode: ${result}`);
		return;
	}

	const packet = opus.HEAPU8.slice(opusEncodeOut, opusEncodeOut + result);
	self.postMessage(["opusPacket", packet, Date.now() - 60], [packet.buffer]);

	if (_debugPlay) {
		const decodeResult = opus._opus_decode_float(opusDecoder, opusEncodeOut, result, opusDecodeOut, opusDecodeOutSize / 4, 0);
		if (decodeResult > 0) {
			const decoded = opus.HEAPF32.slice(opusDecodeOut / 4, opusDecodeOut / 4 + decodeResult);
			self.postMessage(["play", decoded], [decoded.buffer]);
		}
	}
};

/**
 *
 * @param {MessageEvent} ev
 */
const processPlaybackFrame = (ev) => {
	/** @type {Float32Array} */
	const frame = ev.data;

	if (playbackBufferWriterIndex + frame.length > playbackBuffer.length) {
		playbackBuffer.copyWithin(0, frame.length, playbackBufferWriterIndex);
		playbackBufferWriterIndex -= frame.length;
	}

	playbackBuffer.set(frame, playbackBufferWriterIndex);
	playbackBufferWriterIndex += frame.length;
};

/**
 * "Engage!"
 */
(() => {
	log("Initializing...");

	self.importScripts(`opus.js?t=${Date.now()}`);
	self.importScripts(`myFilterLP.js?t=${Date.now()}`);

	createOpusModule().then((module) => {
		opus = module;

		opusEncodeIn = opus._malloc(opusEncodeInSize);
		if (opusEncodeIn === 0) {
			error("Failed to allocate Opus encode in buffer.");
			return;
		}

		opusEncodeOut = opus._malloc(opusEncodeOutSize);
		if (opusEncodeOut === 0) {
			error("Failed to allocate Opus encode out buffer.");
			return;
		}

		opusDecodeOut = opus._malloc(opusDecodeOutSize);
		if (opusDecodeOut === 0) {
			error("Failed to allocate Opus decode out buffer.");
			return;
		}

		log("Opus ready.");

		createMyFilterLPModule().then((module) => {
			filter = module;

			filterInEmx = filter._malloc(0x20);
			if (filterInEmx === 0) {
				error("Failed to allocate filterInEmx.");
				return;
			}

			filterPlaybackEmx = filter._malloc(0x20);
			if (filterPlaybackEmx === 0) {
				error("Failed to allocate filterPlaybackEmx.");
				return;
			}

			filterOutEmx = filter._malloc(0x20);
			if (filterOutEmx === 0) {
				error("Failed to allocate filterOutEmx.");
				return;
			}

			log("Filter ready.");

			self.postMessage(["ready"]);
		}).catch(e => error("Failed to initialize Filter module.", e));
	}).catch(e => error("Failed to initialize Opus module.", e));
})();
