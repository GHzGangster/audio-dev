class AudioProxyProcessor extends AudioWorkletProcessor {
	
	process(inputs, outputs, parameters) {
		if (inputs.length >= 1 && inputs[0].length >= 1) {
			// Proxy samples from input0,channel0
			const samples = inputs[0][0];
			this.port.postMessage(samples);

			// Pass input0,channel0 to output0,channel0
			outputs[0][0].set(samples);
		}
		return true;
	}
	
}

registerProcessor('audio_proxy_processor', AudioProxyProcessor);
