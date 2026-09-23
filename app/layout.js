import "./globals.css";

export const metadata = {
  title: "LinguaFlow",
  description: "AI language learning from real content"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
