import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/ui";

const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const ContactsPage = lazy(() => import("./pages/ContactsPage").then((module) => ({ default: module.ContactsPage })));
const MediaPage = lazy(() => import("./pages/MediaPage").then((module) => ({ default: module.MediaPage })));
const ContributionsPage = lazy(() => import("./pages/ContributionsPage").then((module) => ({ default: module.ContributionsPage })));
const ConversationsPage = lazy(() => import("./pages/ConversationsPage").then((module) => ({ default: module.ConversationsPage })));
const ChatListPage = lazy(() => import("./pages/ChatListPage").then((module) => ({ default: module.ChatListPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((module) => ({ default: module.SearchPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="正在加载页面" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<Page><OverviewPage /></Page>} />
        <Route path="contacts" element={<Page><ContactsPage /></Page>} />
        <Route path="media" element={<Page><MediaPage /></Page>} />
        <Route path="contributions" element={<Page><ContributionsPage /></Page>} />
        <Route path="conversations" element={<Page><ConversationsPage /></Page>} />
        <Route path="chat-list" element={<Page><ChatListPage /></Page>} />
        <Route path="search" element={<Page><SearchPage /></Page>} />
        <Route path="settings" element={<Page><SettingsPage /></Page>} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
