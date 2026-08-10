import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { EnergyDetailPage } from '../features/energy/EnergyDetailPage'
import { EnergyFormPage } from '../features/energy/EnergyFormPage'
import { EnergyPage } from '../features/energy/EnergyPage'
import { CheckInPage } from '../features/experiment/CheckInPage'
import { ExperimentFormPage } from '../features/experiment/ExperimentFormPage'
import { LongTermCheckInPage } from '../features/long-term/LongTermCheckInPage'
import { ReviewPage } from '../features/review/ReviewPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ItemDetailPage } from '../features/library/ItemDetailPage'
import { ItemFormPage } from '../features/library/ItemFormPage'
import { LibraryPage } from '../features/library/LibraryPage'
import { TodayPage } from '../features/today/TodayPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="energy/new" element={<EnergyFormPage mode="new" />} />
        <Route path="energy/:entryId/edit" element={<EnergyFormPage mode="edit" />} />
        <Route path="energy/:entryId" element={<EnergyDetailPage />} />
        <Route path="energy" element={<EnergyPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="items/new" element={<ItemFormPage mode="new" />} />
        <Route path="items/:itemId" element={<ItemDetailPage />} />
        <Route path="items/:itemId/edit" element={<ItemFormPage mode="edit" />} />
        <Route path="items/:itemId/experiments/new" element={<ExperimentFormPage />} />
        <Route path="items/:itemId/long-term/check-in" element={<LongTermCheckInPage />} />
        <Route path="experiments/:cycleId/check-in" element={<CheckInPage />} />
        <Route path="experiments/:cycleId/review" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}
