import { createContext, useContext } from "react";

export const DiscreetContext = createContext<boolean>(false);

export function useDiscreet(): boolean {
  return useContext(DiscreetContext);
}
