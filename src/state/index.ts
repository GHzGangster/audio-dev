import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import appReducer from "./app/reducer";

const store = configureStore({
	reducer: {
		app: appReducer,
	},
});

export default store;

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
	ReturnType,
	RootState,
	unknown,
	Action<string>
>;
