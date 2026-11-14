import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: "Расписание ТСПК — бот для Макса",
  description: "Веб-бот для расписания Тольяттинского социально-педагогического колледжа. Сегодня, завтра, неделя, по дате — для вашей группы.",
  keywords: ["ТСПК", "расписание", "колледж", "бот", "Тольятти", "студент"],
  authors: [{ name: "Z.ai" }],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Расписание ТСПК",
    description: "Веб-бот для расписания Тольяттинского социально-педагогического колледжа",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2e8db2" },
    { media: "(prefers-color-scheme: dark)", color: "#1d5a78" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Apply the saved accessibility zoom + design theme before first
            paint (no flash). Full logic lives in accessibility-zoom.tsx /
            theme-picker.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var z=parseFloat(localStorage.getItem('tspk:uiZoom'));if(z&&z>1&&z<=20){document.documentElement.style.setProperty('--ui-zoom',String(z));}}catch(e){}" +
              "try{var t=localStorage.getItem('tspk:theme');if(t&&t!=='classic'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}",
          }}
        />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
