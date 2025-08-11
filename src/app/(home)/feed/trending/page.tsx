// Importamos las utilidades necesarias de trpc para la comunicación cliente-servidor
import { DEFAULT_LIMIT } from "@/constants";
import { HydrateClient, trpc } from "@/trpc/server";
import { TrendingView } from "@/modules/home/ui/views/trending-view";

// Definimos una constante para forzar la carga dinámica de este componente
export const dynamic = "force-dynamic";

// Definimos el componente principal Home como async
export default async function TrendingPage() {
  // Prefetch: Precarga los datos antes de que sean necesarios
  // void se usa para ignorar la promesa ya que no necesitamos esperar su resultado
  void trpc.videos.getManyTrending.prefetchInfinite({
    limit: DEFAULT_LIMIT,
  });

  return (
    // HydrateClient: Asegura que los datos de trpc estén disponibles en el cliente
    <HydrateClient>
      <TrendingView />
    </HydrateClient>
  );
}
