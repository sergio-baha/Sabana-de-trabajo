import { RouterProvider } from "react-router"
import { AppProviders } from "@/app/providers"
import { router } from "@/routes/router"
import { useAuthBootstrap } from "@/features/auth/hooks/useAuthBootstrap"

function App() {
  useAuthBootstrap()
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
