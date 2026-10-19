import React from "react";
import ReactDOM from "react-dom/client";
import "../../styles/tokens.css";
import "../../styles/base.css";
import "../../styles/thread.css";
import "../../styles/settings.css";
import "../../styles/companion.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
