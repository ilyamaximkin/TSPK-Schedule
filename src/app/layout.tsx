import type { Metadata } from "next";
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
  openGraph: {
    title: "Расписание ТСПК",
    description: "Веб-бот для расписания Тольяттинского социально-педагогического колледжа",
    type: "website",
  },
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
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
