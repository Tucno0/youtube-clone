// Importamos las utilidades necesarias de trpc para la comunicación cliente-servidor
import { HomeView } from "@/modules/home/ui/views/home-view";
import { HydrateClient, trpc } from "@/trpc/server";

// Definimos una constante para forzar la carga dinámica de este componente
export const dynamic = "force-dynamic";

// Importamos el componente cliente que contiene la lógica de UI

interface HomeViewProps {
  searchParams: Promise<{ categoryId?: string }>;
}

// Definimos el componente principal Home como async
export default async function HomePage({ searchParams }: HomeViewProps) {
  const { categoryId } = await searchParams;

  // Prefetch: Precarga los datos antes de que sean necesarios
  // void se usa para ignorar la promesa ya que no necesitamos esperar su resultado
  void trpc.categories.getMany();

  return (
    // HydrateClient: Asegura que los datos de trpc estén disponibles en el cliente
    <HydrateClient>
      <HomeView categoryId={categoryId} />
    </HydrateClient>
  );
}
