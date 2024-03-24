import React from 'react';
import { useAppDispatch, useAppSelector } from "../../state/hooks";
import { setReadyStatus, setRunStatus } from "../../state/app/actions";
import { ReadyStatus, RunStatus } from "../../state/app/reducer";
import { AppThunk } from "../../state";
import { getRunner } from "./Runner";

const initRun = (): AppThunk => async (dispatch, getState) => {
	const state = getState();

	const readyStatus = state.app.readyStatus;
	if (readyStatus !== ReadyStatus.None) {
		return;
	}

	dispatch(setReadyStatus(ReadyStatus.Initializing));
	const runner = getRunner();

	try {
		await runner.init();
		dispatch(setReadyStatus(ReadyStatus.Ready));
	} catch (e) {
		console.error(e);
		dispatch(setReadyStatus(ReadyStatus.Failed));
	}
};

const startRun = (): AppThunk => async (dispatch, getState) => {
	const state = getState();

	const readyStatus = state.app.readyStatus;
	if (readyStatus !== ReadyStatus.Ready) {
		return;
	}

	const runStatus = state.app.runStatus;
	if (runStatus !== RunStatus.Idle && runStatus !== RunStatus.Stopped) {
		return;
	}

	dispatch(setRunStatus(RunStatus.Running));

	const runner = getRunner();
	runner.start();
};

const stopRun = (): AppThunk => async (dispatch, getState) => {
	const state = getState();

	const runStatus = state.app.runStatus;
	if (runStatus !== RunStatus.Running) {
		return;
	}

	const runner = getRunner();
	runner.stop();

	dispatch(setRunStatus(RunStatus.Stopped));
};

const Run = () => {
	const dispatch = useAppDispatch();

	const readyStatus = useAppSelector(state => state.app.readyStatus);
	const runStatus = useAppSelector(state => state.app.runStatus);

	if (readyStatus === ReadyStatus.None) {
		dispatch(initRun());
	}

	const onStartClicked = () => {
		dispatch(startRun());
	};

	const onStopClicked = () => {
		dispatch(stopRun());
	};

	return (
		<div className="content-wrapper">
			<div className="content">
				<div className="content-title">Run</div>
				<p>This is where you run stuff!</p>
				<div className="run-info">
					<div>Module: Simulated</div>
					<div>Ready: { readyStatus }</div>
					<div>Status: { runStatus }</div>
				</div>
				<div className="run-buttons">
					<button onClick={ onStartClicked } type="button">Start</button>
					<button onClick={ onStopClicked } type="button">Stop</button>
				</div>
			</div>
		</div>
	);
};

export default Run;
