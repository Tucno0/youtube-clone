// Importamos las utilidades necesarias de trpc para la comunicación cliente-servidor
import { HydrateClient, trpc } from "@/trpc/server";
// Importamos el componente cliente que contiene la lógica de UI
import { PageClient } from "./client";
// Importamos Suspense de React para manejar estados de carga
import { Suspense } from "react";
// Importamos ErrorBoundary para manejar errores de forma elegante
import { ErrorBoundary } from "react-error-boundary";

// Definimos el componente principal Home como async
export default async function Home() {
  // Esta línea está comentada pero muestra cómo hacer una llamada directa a trpc
  // const data = await trpc.hello({ text: "world" });

  // Prefetch: Precarga los datos antes de que sean necesarios
  // void se usa para ignorar la promesa ya que no necesitamos esperar su resultado
  void trpc.hello.prefetch({ text: "world" });

  return (
    // HydrateClient: Asegura que los datos de trpc estén disponibles en el cliente
    <HydrateClient>
      {/* Suspense: Muestra un fallback mientras el contenido se carga */}
      <Suspense fallback={<p>Loading...</p>}>
        {/* ErrorBoundary: Captura y maneja errores en el árbol de componentes */}
        <ErrorBoundary fallback={<p>Something went wrong</p>}>
          {/* PageClient: Componente que contiene la UI principal */}
          <PageClient />
        </ErrorBoundary>
      </Suspense>
    </HydrateClient>
  );
}
