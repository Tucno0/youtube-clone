import { useEffect, useRef, useState } from "react";

/**
 * Este hook personalizado se utiliza para detectar cuando un elemento entra o sale del viewport (área visible) del navegador.
 * Es muy útil para implementar funcionalidades como "infinite scroll" o lazy loading de imágenes.
 */

// Hook personalizado que acepta opciones opcionales de configuración
// IntersectionObserverInit es un tipo de TypeScript que define las opciones de configuración del IntersectionObserver
export const useIntersectionObserver = (options?: IntersectionObserverInit) => {
  // Estado para trackear si el elemento está visible
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Referencia al elemento DOM que queremos observar
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Crear una nueva instancia del IntersectionObserver
    // Se ejecuta cada vez que la intersección cambia
    const observer = new IntersectionObserver(([entry]) => {
      // Actualizar el estado con la visibilidad del elemento
      setIsIntersecting(entry.isIntersecting);
    }, options);

    // Si existe el elemento referenciado, comenzar a observarlo
    if (targetRef.current) {
      observer.observe(targetRef.current);
    }

    // Función de limpieza que se ejecuta cuando el componente se desmonta
    return () => {
      if (targetRef.current) {
        // Dejar de observar el elemento para evitar memory leaks
        observer.unobserve(targetRef.current);
      }
    };
  }, [options]); // El efecto se re-ejecuta si cambian las opciones

  // Retornar la referencia y el estado de intersección
  return { targetRef, isIntersecting };
};
