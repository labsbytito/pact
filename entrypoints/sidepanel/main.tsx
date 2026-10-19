import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import React from "react";
import ReactDOM from "react-dom/client";
import "../../styles/tokens.css";
import "../../styles/base.css";
import "../../styles/thread.css";
import "../../styles/settings.css";
import "../../styles/companion.css";
import App from "./App";
import { readPdfSource } from "../../lib/pdf-reader";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

// Test-only hook for automated checks of the bundled readers. Stripped from production builds.
if (import.meta.env.WXT_PUBLIC_PACT_TEST === "1") (window as unknown as { __pactTest?: unknown }).__pactTest = { readPdfSource };
