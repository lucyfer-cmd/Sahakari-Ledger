import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import MemberDetail from './pages/MemberDetail.jsx';
import Accounts from './pages/Accounts.jsx';
import AccountDetail from './pages/AccountDetail.jsx';
import Loans from './pages/Loans.jsx';
import LoanDetail from './pages/LoanDetail.jsx';
import Rates from './pages/Rates.jsx';
import Ledger from './pages/Ledger.jsx';
import Audit from './pages/Audit.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Notifications from './pages/Notifications.jsx';
import NotFound from './pages/NotFound.jsx';

const guard = (permission, el) => <ProtectedRoute permission={permission}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/members" element={guard('member:read', <Members />)} />
        <Route path="/members/:id" element={guard('member:read', <MemberDetail />)} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/loans/:id" element={<LoanDetail />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/ledger" element={guard('ledger:read', <Ledger />)} />
        <Route path="/audit" element={guard('audit:read', <Audit />)} />
        <Route path="/reports" element={guard('report:view', <Reports />)} />
        <Route path="/users" element={guard('user:read', <Users />)} />
        <Route path="/unauthorized" element={<NotFound forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
