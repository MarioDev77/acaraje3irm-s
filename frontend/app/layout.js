import './globals.css';

export const metadata = {
  title: 'Acarajé 3 Irmãs | Sabor que conquista, tradição que encanta!',
  description:
    'Peça agora o acarajé mais gostoso de Itamira - BA. Acarajé no papel, no prato, na marmita, mini acarajés e bebidas geladas, com entrega rápida.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
