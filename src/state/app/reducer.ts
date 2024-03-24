import { setReadyStatus, setRunStatus } from "./actions";
import { createReducer } from "@reduxjs/toolkit";

enum ReadyStatus {
	None = "None",
	Initializing = "Initializing",
	Ready = "Ready",
	Failed = "Failed",
}

enum RunStatus {
	Idle = "Idle",
	Running = "Running",
	Stopped = "Stopped",
}

interface AppState {
	readyStatus: ReadyStatus,
	runStatus: RunStatus,
}

const initialState: AppState = {
	readyStatus: ReadyStatus.None,
	runStatus: RunStatus.Idle,
};

const appReducer = createReducer(initialState, builder =>
	builder.addCase(setReadyStatus, (state, action) => {
		state.readyStatus = action.payload;
	})
	.addCase(setRunStatus, (state, action) => {
		state.runStatus = action.payload;
	})
);

export default appReducer;
export { ReadyStatus, RunStatus };
export type { AppState };
