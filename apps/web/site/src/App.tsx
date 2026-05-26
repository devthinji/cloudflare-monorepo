import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SiteLayout  from './components/SiteLayout'
import HomePage    from './pages/HomePage'
import TajiPage    from './pages/TajiPage'
import ElimPage    from './pages/ElimPage'
import PricingPage from './pages/PricingPage'
import ContactPage from './pages/ContactPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index             element={<HomePage />}    />
          <Route path="taji"       element={<TajiPage />}    />
          <Route path="elim"       element={<ElimPage />}    />
          <Route path="pricing"    element={<PricingPage />} />
          <Route path="contact"    element={<ContactPage />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
