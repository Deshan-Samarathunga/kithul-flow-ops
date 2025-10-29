import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type AppState = {
  isLoading: boolean;
  error?: string | null;
};

const initialState: AppState = {
  isLoading: false,
  error: null,
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    startLoading(state) {
      state.isLoading = true;
      state.error = null;
    },
    stopLoading(state) {
      state.isLoading = false;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { startLoading, stopLoading, setError } = appSlice.actions;
export const selectIsLoading = (state: { app: AppState }) => state.app.isLoading;
export const selectAppError = (state: { app: AppState }) => state.app.error;
export default appSlice.reducer;
