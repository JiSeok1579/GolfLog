import { Navigate, Route, Routes } from "react-router-dom";
import { CalendarPage } from "./CalendarPage";
import { DashboardPage } from "./DashboardPage";
import { DistancePage } from "./DistancePage";
import { HealthPage } from "./HealthPage";
import { RecordDetailPage } from "./RecordDetailPage";
import { ScreenGolfPage } from "./ScreenGolfPage";
import { SettingsPage } from "./SettingsPage";
import { SwingAiPage } from "./SwingAiPage";
import { AuthGate } from "./AuthGate";
import { AppShell } from "../components/layout/AppShell";
import { LanguageProvider } from "../data/i18n";
import { GolfLogProvider } from "../data/store";

export function App() {
  return (
    <LanguageProvider>
      <GolfLogProvider>
        <AuthGate>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/log" element={<Navigate to="/screen-golf" replace />} />
              <Route path="/distance" element={<DistancePage />} />
              <Route path="/screen-golf" element={<ScreenGolfPage />} />
              <Route path="/swing-ai" element={<SwingAiPage />} />
              <Route path="/health" element={<HealthPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/sessions/:sessionId" element={<RecordDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </AuthGate>
      </GolfLogProvider>
    </LanguageProvider>
  );
}
