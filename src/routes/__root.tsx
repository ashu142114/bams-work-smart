import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="mobile-shell flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#5b46e5" },
      { title: "BAMS — Bharat Attendance Management System" },
      { name: "description", content: "Modern attendance, team and workforce management for Indian businesses." },
      { property: "og:title", content: "BAMS — Bharat Attendance Management System" },
      { name: "twitter:title", content: "BAMS — Bharat Attendance Management System" },
      { property: "og:description", content: "Modern attendance, team and workforce management for Indian businesses." },
      { name: "twitter:description", content: "Modern attendance, team and workforce management for Indian businesses." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/df22dfbd-e247-489b-986d-408185c8be67/id-preview-ec58d01f--5d8014cd-7fa6-4760-9730-a2f7dced4b2e.lovable.app-1777039992641.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/df22dfbd-e247-489b-986d-408185c8be67/id-preview-ec58d01f--5d8014cd-7fa6-4760-9730-a2f7dced4b2e.lovable.app-1777039992641.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
