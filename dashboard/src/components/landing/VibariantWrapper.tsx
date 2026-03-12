"use client";

import { VibariantProvider } from "@vibariant/sdk/react";

const config = {
  projectToken: "vv_proj_UO51wHns6EC4-_UjkC7MRU5qGObSzuay",
  apiHost: "https://api.vibariant.com",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function VibariantWrapper({ children }: { children: any }) {
  return <VibariantProvider config={config}>{children}</VibariantProvider>;
}
