import { useContext } from "react";
import { ReturnsContext } from "./return.context";

export function useReturns() {
  const context = useContext(ReturnsContext);
  if (!context) {
    throw new Error("useReturns must be used within a ReturnsProvider");
  }
  return context;
}
