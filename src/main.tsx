import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import LiveApp from "./live/LiveApp";
import "./styles.css";

const demo = window.location.pathname === '/demo' || window.location.pathname.startsWith('/demo/');
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={demo ? '/demo' : '/'}>
      {demo ? <><div className="r-demo-boundary">Sample data only · no real accounts or payments<a href="/">Leave demo</a></div><App /></> : <LiveApp />}
    </BrowserRouter>
  </StrictMode>,
);
