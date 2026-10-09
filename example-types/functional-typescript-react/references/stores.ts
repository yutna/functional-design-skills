import type { Draft } from "immer";
import type { Brand } from "../../_shared/result";

// Redux Toolkit is not one of the example libraries, so `createSlice` and
// `PayloadAction` are declared with the shape of its signature. A case
// reducer receives immer's `Draft` of the state, as the real one does, and
// its action parameter is whatever the reducer annotates it as.
type PayloadAction<P> = { readonly type: string; readonly payload: P };
type CaseReducers<S> = {
  readonly [name: string]: (state: Draft<S>, action: never) => void;
};
declare const createSlice: <S, R extends CaseReducers<S>>(options: {
  readonly name: string;
  readonly initialState: S;
  readonly reducers: R;
}) => { readonly name: string; readonly caseReducers: R };

// Names the fences use without defining.
type SlotId = Brand<string, "SlotId">;
type State = {
  readonly booking: {
    readonly slot: { readonly id: SlotId | null };
  };
  readonly bookings: readonly {
    readonly paid: boolean;
    readonly amount: number;
  }[];
};
declare const initialState: State;
