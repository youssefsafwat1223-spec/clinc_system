import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const InboxPage = lazy(() => import('./pages/InboxPage.jsx'));
const PatientsPage = lazy(() => import('./pages/PatientsPage.jsx'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage.jsx'));
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx'));
const StaffPage = lazy(() => import('./pages/StaffPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const AISettingsPage = lazy(() => import('./pages/AISettingsPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage.jsx'));
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage.jsx'));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage.jsx'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage.jsx'));
const PrescriptionsPage = lazy(() => import('./pages/PrescriptionsPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const RescheduleDoctorPage = lazy(() => import('./pages/RescheduleDoctorPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage.jsx'));
const DataDeletionPage = lazy(() => import('./pages/DataDeletionPage.jsx'));

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-dark-bg">
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-primary-500"></div>
      <div
        className="absolute inset-2 animate-spin rounded-full border-r-2 border-primary-400 opacity-75"
        style={{ animationDuration: '1.4s' }}
      ></div>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/data-deletion" element={<DataDeletionPage />} />

          {/* Protected dashboard routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <InboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute>
                <PatientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultations"
            element={
              <ProtectedRoute>
                <ConsultationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/prescriptions"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
                <PrescriptionsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'RECEPTION']}>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reschedule-doctor"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <RescheduleDoctorPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/services"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ServicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                <CampaignsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AISettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reviews"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
                <ReviewsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
