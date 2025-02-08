import { Ratelimit } from "@upstash/ratelimit"; // Importamos la clase Ratelimit de upstash
import { redis } from "./redis"; // Importamos la instancia de redis configurada

// Creamos y exportamos una nueva instancia de Ratelimit
export const ratelimit = new Ratelimit({
  redis: redis, // Usamos la instancia de redis como almacenamiento
  // Configuramos una ventana deslizante
  // con un límite de 10 peticiones cada 10 segundos (10/s)
  limiter: Ratelimit.slidingWindow(10, "10s"),
});
