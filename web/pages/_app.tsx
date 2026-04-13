import type { AppProps } from "next/app";
import { Syne, DM_Sans } from "next/font/google";
import "../styles/globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${syne.variable} ${dmSans.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
