import { RouterProvider } from "react-router"
import { AppProviders } from "@/app/providers"
import { router } from "@/routes/router"
import { useAuthBootstrap } from "@/features/auth/hooks/useAuthBootstrap"
import BuildInfoBadge from "@/components/shared/BuildInfoBadge"

function App() {
  useAuthBootstrap()
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <BuildInfoBadge />
    </AppProviders>
  )
}

export default App
