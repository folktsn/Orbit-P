import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { MainLayoutContent } from "@/components/MainLayoutContent";
import { DisplayPreferencesProvider } from "@/components/DisplayPreferencesProvider";

const sukhumvit = localFont({
  src: [
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-Thin.woff2", weight: "100", style: "normal" },
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-Text.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/sukhumvit/SukhumvitSet-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sukhumvit",
  display: "swap",
  // Download only the weights used on the current page.
  preload: false,
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "HO-Recruitment",
  description: "Aviation-inspired Enterprise Resource Planning Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sukhumvit.variable} h-full font-sans antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col text-slate-900 bg-slate-50 dark:bg-black dark:text-slate-100 selection:bg-slate-200 selection:text-slate-900 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DisplayPreferencesProvider>
            <AuthProvider>
              <MainLayoutContent>
                {children}
              </MainLayoutContent>
            </AuthProvider>
          </DisplayPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
