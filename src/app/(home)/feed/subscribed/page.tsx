// Importamos las utilidades necesarias de trpc para la comunicación cliente-servidor
import { DEFAULT_LIMIT } from "@/constants";
import { HydrateClient, trpc } from "@/trpc/server";
import { SubscribedView } from "@/modules/home/ui/views/subscribed-view";

// Definimos una constante para forzar la carga dinámica de este componente
export const dynamic = "force-dynamic";

// Definimos el componente principal Home como async
export default async function SubscribedPage() {
  // Prefetch: Precarga los datos antes de que sean necesarios
  // void se usa para ignorar la promesa ya que no necesitamos esperar su resultado
  void trpc.videos.getManySubscribed.prefetchInfinite({
    limit: DEFAULT_LIMIT,
  });

  return (
    // HydrateClient: Asegura que los datos de trpc estén disponibles en el cliente
    <HydrateClient>
      <SubscribedView />
    </HydrateClient>
  );
}
