import type { Metadata } from 'next';
import './globals.css';

const title = '欧洲三国行程｜2026.09.26—10.08';
const description =
  '2026年9月26日至10月8日，巴黎、米兰、佛罗伦萨、罗马、梵蒂冈与布达佩斯行程执行网站。';

function getTrustedSiteOrigin() {
  const configuredOrigin = process.env.SITE_ORIGIN?.trim();

  if (!configuredOrigin) return null;

  try {
    const url = new URL(configuredOrigin);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const siteOrigin = getTrustedSiteOrigin();
  const socialImage = siteOrigin ? `${siteOrigin}/og.png` : null;

  return {
    title,
    description,
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'zh_CN',
      ...(socialImage
        ? {
            images: [
              {
                url: socialImage,
                width: 1200,
                height: 630,
                alt: '欧洲三国行程：巴黎、米兰、佛罗伦萨、罗马与布达佩斯',
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
