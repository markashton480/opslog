import { RouterProvider, createMemoryRouter } from "react-router-dom";

import router, { appRoutes } from "@/router";

export default function App({ initialEntries }: { initialEntries?: string[] }) {
  const testRouter = initialEntries 
    ? createMemoryRouter(appRoutes, { initialEntries }) 
    : router;
    
  return <RouterProvider router={testRouter} />;
}
