import { createAction } from "@reduxjs/toolkit";
import { ReadyStatus, RunStatus } from "./reducer";

const setReadyStatus = createAction<ReadyStatus>("app/setReadyStatus");
const setRunStatus = createAction<RunStatus>("app/setRunStatus");

export { setReadyStatus, setRunStatus };
