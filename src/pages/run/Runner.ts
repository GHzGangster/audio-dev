import RunWorker from "./RunWorker";

class Runner {

	private context = new AudioContext({ sampleRate: 16000 });
	private bufferSourceNode: AudioBufferSourceNode | undefined;

	private worker: Worker | undefined;
	private inputNode: AudioWorkletNode | undefined;
	private outputNode: AudioWorkletNode | undefined;

	public async init() {
		this.initWorker();
		await this.initWorklets();
		await this.initSource();
	}

	private initWorker() {
		let code = RunWorker.toString();
		code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

		const blob = new Blob([ code ], { type: "application/javascript" });

		this.worker = new Worker(URL.createObjectURL(blob));
	}

	private async initWorklets() {
		await this.context.audioWorklet.addModule(`${process.env.PUBLIC_URL}/workers/audio_proxy_processor.js`);

		this.inputNode = new AudioWorkletNode(this.context, "audio_proxy_processor");
		this.inputNode.connect(this.context.destination);

		this.outputNode = new AudioWorkletNode(this.context, "audio_proxy_processor");
		this.outputNode.connect(this.context.destination);
	}

	private async initSource() {
		const response = await fetch(`${process.env.PUBLIC_URL}/workers/speech_orig.wav?t=${Date.now()}`);
		if (response.ok) {
			const array = await response.arrayBuffer();
			const audioBuffer = await this.context.decodeAudioData(array);

			this.bufferSourceNode = new AudioBufferSourceNode(this.context);
			this.bufferSourceNode.buffer = audioBuffer;
			this.bufferSourceNode.connect(this.inputNode!);
		}
	}

	public start() {
		if (!this.bufferSourceNode) {
			return;
		}

		this.bufferSourceNode.start();

		// TODO dtouve: Need to play the audio file plus a specified delay, and then grab that exact number of samples to process.
	}

	public stop() {
		if (this.bufferSourceNode) {
			this.bufferSourceNode.stop();
		}

		// await this.context.suspend();
	}

}

const runner = new Runner();
const getRunner = () => runner;

export { getRunner };
