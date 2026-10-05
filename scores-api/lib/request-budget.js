import { AsyncLocalStorage } from 'node:async_hooks';
const budget = new AsyncLocalStorage();
// Leave time to serialize an honest error before the platform's ten-second cap.
export const boundedHandler = handler => (req, res) => budget.run(AbortSignal.timeout(8000), () => handler(req, res));
export const upstreamSignal = () => budget.getStore()
  ? AbortSignal.any([budget.getStore(), AbortSignal.timeout(3000)])
  : AbortSignal.timeout(3000);
