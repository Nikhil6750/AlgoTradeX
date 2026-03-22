import { useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";

import Analytics from "./pages/Analytics";
import BacktestHistory from "./pages/BacktestHistory";
import Dashboard from "./pages/Dashboard";
import MarketReplay from "./pages/MarketReplay";
import Results from "./pages/Results";
import SentimentLab from "./pages/SentimentLab";
import Setups from "./pages/Setups";
import StrategyLab from "./pages/StrategyLab";
import AppNav from "./components/ui/AppNav";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import ThemeToggle from "./components/ui/ThemeToggle";
import { ThemeProvider } from "./context/ThemeContext";

const NAV_ROUTES = [
  "/dashboard",
  "/market-replay",
  "/strategy-lab",
  "/setups",
  "/backtests",
  "/results",
  "/analytics",
  "/sentiment-lab",
];

function AnimatedRoutes() {
  const location = useLocation();
  const showNav = NAV_ROUTES.some((route) => location.pathname.startsWith(route));

  return (
    <>
      {showNav && <AppNav />}
      <div className={showNav ? "min-h-screen md:pl-[240px]" : "min-h-screen"}>
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard"             element={<Dashboard />} />
            <Route path="/market-replay"         element={<MarketReplay />} />
            <Route path="/strategy-lab"          element={<StrategyLab />} />
            <Route path="/setups/:backtestId"    element={<Setups />} />
            <Route path="/backtests"             element={<BacktestHistory />} />
            <Route path="/results"               element={<Results />} />
            <Route path="/results/:backtestId"   element={<Results />} />
            <Route path="/analytics"             element={<Analytics />} />
            <Route path="/sentiment-lab"         element={<SentimentLab />} />

            <Route path="/replay"  element={<Navigate to="/market-replay" replace />} />
            <Route path="/setup"   element={<Navigate to="/strategy-lab"  replace />} />
            <Route path="/upload"  element={<Navigate to="/strategy-lab"  replace />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </AnimatePresence>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeToggle />
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#111111",
              color: "#ffffff",
              border: "1px solid #222222",
            },
          }}
        />
        <AnimatedRoutes />
      </Router>
    </ThemeProvider>
  );
}
