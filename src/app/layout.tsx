import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { MainLayoutContent } from "@/components/MainLayoutContent";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "S Recruit",
  description: "Aviation-inspired Enterprise Resource Planning Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col text-slate-900 bg-slate-50 dark:bg-black dark:text-slate-100 selection:bg-slate-200 selection:text-slate-900 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <MainLayoutContent>
              {children}
            </MainLayoutContent>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
