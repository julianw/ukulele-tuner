/** True only when started with `npm run dev:debug`. Vite strips this in production builds. */
export const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true'
