import './App.css'
import Pages from "@/pages"
import { Toaster } from "@/components/ui/toaster"

function App(): JSX.Element {
  return (
    <>
      <Pages />
      <Toaster />
    </>
  )
}

export default App
