import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "@/components/ui";

import LoginPage from "@/app/login/page";
import SharedReportPage from "@/app/bagikan/[id]/page";
import { AppLayout } from "./AppLayout";

import StandupPage from "@/app/(app)/page";
import TasksPage from "@/app/(app)/tugas/page";
import LaporanPage from "@/app/(app)/laporan/page";
import ReportFocusPage from "@/app/(app)/laporan/lihat/page";
import DivisiPage from "@/app/(app)/divisi/page";
import ImporPage from "@/app/(app)/impor/page";
import PenggunaPage from "@/app/(app)/pengguna/page";
import LivePage from "@/app/(app)/live/page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman Publik */}
        <Route
          path="/login"
          element={
            <ToastProvider>
              <LoginPage />
            </ToastProvider>
          }
        />
        <Route
          path="/bagikan/:id"
          element={
            <ToastProvider>
              <SharedReportPage />
            </ToastProvider>
          }
        />

        {/* Halaman Terproteksi */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<StandupPage />} />
          <Route path="/tugas" element={<TasksPage />} />
          <Route path="/laporan" element={<LaporanPage />} />
          <Route path="/laporan/lihat" element={<ReportFocusPage />} />
          <Route path="/divisi" element={<DivisiPage />} />
          <Route path="/impor" element={<ImporPage />} />
          <Route path="/pengguna" element={<PenggunaPage />} />
          <Route path="/live" element={<LivePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
