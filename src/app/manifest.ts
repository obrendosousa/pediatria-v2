import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aliança Kids Scanner',
    short_name: 'Scanner',
    description: 'Leitor de Código de Barras para PDV',
    start_url: '/loja',
    display: 'standalone', // Isso remove a barra de endereço do navegador
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}