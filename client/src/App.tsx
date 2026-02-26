import React from "react";
import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={Home} />
        <Route>
          <div className="min-h-screen flex items-center justify-center flex-col text-center p-4">
            <h1 className="text-4xl font-bold mb-2">404</h1>
            <p className="text-muted-foreground mb-6">This page doesn't exist.</p>
            <a href="/" className="text-primary hover:underline font-medium">Return Home</a>
          </div>
        </Route>
      </Switch>
    </QueryClientProvider>
  );
}

export default App;
