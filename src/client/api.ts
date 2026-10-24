import { treaty } from "@elysiajs/eden";

// Client Eden Treaty ke Elysia 2 server
export const api = treaty<any>(window.location.origin);
