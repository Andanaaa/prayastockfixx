import React from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                AD
              </div>
              <div>
                <div className="font-medium text-gray-700">Admin</div>
                <div className="text-sm text-gray-500">andana</div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-4 p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}